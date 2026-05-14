// Excel 처리: ZIP/XML 직접 수정 방식
// - openpyxl/xlsx 라이브러리로 재저장하면 스타일/수식이 깨질 수 있음
// - 따라서 jszip으로 압축 풀고 xl/worksheets/sheet*.xml 의 <c> 셀만 in-place 교체
// - 수식 셀(<f> 포함)은 절대 건드리지 않음
// - sharedStrings.xml 의 월 표기("N월")만 교체

import JSZip from 'jszip';
import {
  getColForMonth,
  DIRECT_INPUT_ROWS,
  buildMonthReplacers,
  RAW_DATA_HINT,
} from './quality-field-map.js';
import { updateRollingWindowCharts } from './rolling-window-charts.js';

// ──────────────────────────────────────────────────────────────────────
// XML helpers (regex-based — sheet XML is huge, DOM은 비현실적)
// ──────────────────────────────────────────────────────────────────────

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSheetIndex(workbookXml) {
  // <sheet name="..." sheetId="..." r:id="rIdN"/>
  const re = /<sheet\s+[^>]*?name="([^"]+)"[^>]*?(?:sheetId="(\d+)")?[^>]*?r:id="(rId\d+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(workbookXml)) !== null) {
    out.push({ name: m[1], rId: m[3] });
  }
  return out;
}

function parseRels(relsXml) {
  // <Relationship Id="rIdN" Target="worksheets/sheet1.xml" .../>
  const re = /<Relationship\s+[^>]*?Id="(rId\d+)"[^>]*?Target="([^"]+)"/g;
  const map = {};
  let m;
  while ((m = re.exec(relsXml)) !== null) map[m[1]] = m[2];
  return map;
}

// Parse a single <c> cell: extract r="A1", t="...", and its inner text/v
function parseCellRef(ref) {
  // "A1", "AB123"
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  return { col: m[1], row: parseInt(m[2], 10) };
}

// Build a map { "A1": { tag, attrs, inner } } from a worksheet XML.
// (very large XMLs — we don't actually build this in memory; we scan + replace)

// Replace numeric value of cell at ref in worksheet XML in-place.
// - Only updates cells that do NOT contain <f> (formula) tag.
// - Keeps style index (s="N") intact.
function replaceCellValue(sheetXml, ref, newValue) {
  // Match the full <c r="ref" ...>...</c> or self-closing <c r="ref" .../>
  const reFull = new RegExp(
    `<c\\s+([^/>]*?\\br="${ref}"[^/>]*?)>([\\s\\S]*?)</c>`,
    ''
  );
  const reSelf = new RegExp(`<c\\s+([^/>]*?\\br="${ref}"[^/>]*?)/>`, '');

  const fullMatch = sheetXml.match(reFull);
  if (fullMatch) {
    const attrs = fullMatch[1];
    const inner = fullMatch[2];
    if (inner.includes('<f')) return sheetXml; // formula — skip
    if (newValue === null || newValue === undefined || newValue === '') return sheetXml;
    // Strip t="..." attr (force numeric/inline) and re-add appropriately
    let newAttrs = attrs.replace(/\s+t="[^"]*"/g, '');
    const num = Number(newValue);
    let newInner;
    if (Number.isFinite(num) && String(newValue).trim() !== '') {
      newInner = `<v>${num}</v>`;
    } else {
      newAttrs += ' t="inlineStr"';
      newInner = `<is><t>${escapeXml(newValue)}</t></is>`;
    }
    const replacement = `<c ${newAttrs}>${newInner}</c>`;
    return sheetXml.replace(reFull, replacement);
  }

  const selfMatch = sheetXml.match(reSelf);
  if (selfMatch) {
    if (newValue === null || newValue === undefined || newValue === '') return sheetXml;
    const attrs = selfMatch[1].replace(/\s+t="[^"]*"/g, '');
    const num = Number(newValue);
    let inner;
    let extra = '';
    if (Number.isFinite(num) && String(newValue).trim() !== '') {
      inner = `<v>${num}</v>`;
    } else {
      extra = ' t="inlineStr"';
      inner = `<is><t>${escapeXml(newValue)}</t></is>`;
    }
    return sheetXml.replace(reSelf, `<c ${attrs}${extra}>${inner}</c>`);
  }

  return sheetXml; // cell not found — leave as-is
}

// Read raw cell value (number or shared-string-resolved text) from a sheet XML.
// Returns null when not found / formula / empty.
function readCellValue(sheetXml, ref, sharedStrings) {
  const reFull = new RegExp(`<c\\s+([^/>]*?\\br="${ref}"[^/>]*?)>([\\s\\S]*?)</c>`, '');
  const reSelf = new RegExp(`<c\\s+([^/>]*?\\br="${ref}"[^/>]*?)/>`, '');
  const m = sheetXml.match(reFull);
  if (!m) {
    if (sheetXml.match(reSelf)) return null;
    return null;
  }
  const attrs = m[1];
  const inner = m[2];
  if (inner.includes('<f')) {
    // formula — try to read cached <v>
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
    if (v) {
      const n = Number(v[1]);
      return Number.isFinite(n) ? n : v[1];
    }
    return null;
  }
  const tMatch = /\bt="([^"]+)"/.exec(attrs);
  const t = tMatch ? tMatch[1] : '';
  if (t === 's') {
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
    if (!v) return null;
    const idx = parseInt(v[1], 10);
    return sharedStrings[idx] ?? null;
  }
  if (t === 'inlineStr') {
    const ts = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
    return ts ? ts[1] : null;
  }
  // numeric / boolean / default
  const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
  if (!v) return null;
  const n = Number(v[1]);
  return Number.isFinite(n) ? n : v[1];
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const arr = [];
  const reSi = /<si\b[\s\S]*?<\/si>/g;
  let m;
  while ((m = reSi.exec(xml)) !== null) {
    const si = m[0];
    // collect all <t> contents
    const reT = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let parts = '';
    let tm;
    while ((tm = reT.exec(si)) !== null) parts += tm[1];
    arr.push(parts
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
    );
  }
  return arr;
}

// Rewrite sharedStrings.xml: for each <si>'s text, run regex replacers
function rewriteSharedStrings(xml, replacers) {
  if (!xml || !replacers.length) return xml;
  return xml.replace(/<t([^>]*)>([\s\S]*?)<\/t>/g, (_, attrs, txt) => {
    let out = txt
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    for (const [re, rep] of replacers) out = out.replace(re, rep);
    return `<t${attrs}>${escapeXml(out)}</t>`;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Process the monthly quality Excel report.
 * @param {Buffer} prevExcelBuf  — previous month's completed Excel
 * @param {Buffer} rawDataBuf    — current month raw Korea Report (.xlsx)
 * @param {number} prevMonth     — 1..12
 * @param {number} curMonth      — 1..12
 * @param {number} rollingWindowSize — chart data window size (default 3 months)
 * @returns {Promise<Buffer>}    — output xlsx buffer
 */
export async function processQualityExcel({ prevExcelBuf, rawDataBuf, prevMonth, curMonth, rollingWindowSize = 3 }) {
  let outZip = await JSZip.loadAsync(prevExcelBuf);
  const rawZip = rawDataBuf ? await JSZip.loadAsync(rawDataBuf) : null;

  // ── 1. Read workbook index for both files ───────────────────────────
  const wbXml = await outZip.file('xl/workbook.xml').async('string');
  const wbRelsXml = await outZip.file('xl/_rels/workbook.xml.rels').async('string');
  const sheets = parseSheetIndex(wbXml);
  const rels = parseRels(wbRelsXml);

  const rawSheets = rawZip ? parseSheetIndex(await rawZip.file('xl/workbook.xml').async('string')) : [];
  const rawRels   = rawZip ? parseRels(await rawZip.file('xl/_rels/workbook.xml.rels').async('string')) : {};
  const rawSharedRaw = rawZip && rawZip.file('xl/sharedStrings.xml')
    ? await rawZip.file('xl/sharedStrings.xml').async('string') : '';
  const rawShared = parseSharedStrings(rawSharedRaw);

  // ── 2. For each target sheet, perform value replacement ────────────
  const targetSheets = Object.keys(DIRECT_INPUT_ROWS);

  for (const sheetName of targetSheets) {
    const sheetMeta = sheets.find(s => s.name === sheetName);
    if (!sheetMeta) continue;
    const sheetPath = `xl/${rels[sheetMeta.rId]}`;
    if (!outZip.file(sheetPath)) continue;

    let sheetXml = await outZip.file(sheetPath).async('string');

    const col = getColForMonth(sheetName, curMonth);
    if (!col) continue;
    const { from, to } = DIRECT_INPUT_ROWS[sheetName];

    // Try to find matching raw sheet (by name alias)
    let rawSheetXml = null;
    if (rawZip) {
      const aliases = RAW_DATA_HINT.candidateSheetAliases[sheetName] || [sheetName];
      const matched = rawSheets.find(rs => aliases.some(a => rs.name.toLowerCase().includes(a.toLowerCase())));
      if (matched) {
        const rp = `xl/${rawRels[matched.rId]}`;
        if (rawZip.file(rp)) rawSheetXml = await rawZip.file(rp).async('string');
      }
    }

    if (rawSheetXml) {
      // For each row in the direct-input range, copy from raw(same col,row) → out(col,row)
      for (let row = from; row <= to; row++) {
        const ref = `${col}${row}`;
        const v = readCellValue(rawSheetXml, ref, rawShared);
        if (v === null || v === undefined || v === '') continue;
        sheetXml = replaceCellValue(sheetXml, ref, v);
      }
    }
    // else: no raw match — leave previous-month values intact (best effort)

    outZip.file(sheetPath, sheetXml);
  }

  // ── 3. Replace month labels in sharedStrings ───────────────────────
  const ssPath = 'xl/sharedStrings.xml';
  if (outZip.file(ssPath)) {
    const ssXml = await outZip.file(ssPath).async('string');
    const replacers = buildMonthReplacers(prevMonth, curMonth);
    outZip.file(ssPath, rewriteSharedStrings(ssXml, replacers));
  }

  // ── 4. Update chart data ranges for rolling window ─────────────────
  const tempBuf = await outZip.generateAsync({ type: 'nodebuffer' });
  const updatedBuf = await updateRollingWindowCharts({
    buf: tempBuf,
    prevMonth,
    curMonth,
    windowSize: rollingWindowSize,
    fileType: 'xlsx',
    sheetName: '월지표',
  });

  // ── 5. Output buffer ───────────────────────────────────────────────
  return updatedBuf;
}
