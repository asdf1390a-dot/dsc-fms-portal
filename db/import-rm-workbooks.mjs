#!/usr/bin/env node
// Import 7 R&M Excel workbooks → Supabase rm_workbooks / rm_monthly_rows.
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   source ~/.config/dsc-fms-secrets/supabase.env
//   node db/import-rm-workbooks.mjs
//   node db/import-rm-workbooks.mjs --dry          # parse only, no writes
//   node db/import-rm-workbooks.mjs --only=1.2     # one workbook
//
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const INBOUND = '/home/jeepney/.openclaw-dev/media/inbound';
const YEAR = 2026;
const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;

const WORKBOOKS = [
  { key: '1.1', match: /^1_1_R_M_MAINTENANCE.*\.xlsx$/ },
  { key: '1.2', match: /^1\.2_-_R_M_-_JIG_R_M.*\.xlsx$/ },
  { key: '1.3', match: /^1\.3_-_R_M_-_MOULD_R_M.*\.xlsx$/ },
  { key: '1.4', match: /^1\.4_-_R_M_-_FABRICATION_R_M.*\.xlsx$/ },
  { key: '1.5', match: /^1\.5_-_R_M_-_OTHER_TEAM_R_M.*\.xlsx$/ },
  { key: '1.6', match: /^1_6_R_M_FACTORY_MAINTENANCE.*\.xlsx$/ },
  { key: '1.7', match: /^1\.7_-_R_M_-_STP_R_M.*\.xlsx$/ },
];

const MONTH_PATTERN = /^(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG(UST)?|SEPT?(EMBER)?|OCT(OBER)?|NOV(EMBER)?|DEC(EMBER)?)\s*-\s*\d{4}/i;
const MONTH_MAP = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUNE:6,JUL:7,JULY:7,AUG:8,AUGUST:8,SEP:9,SEPT:9,SEPTEMBER:9,OCT:10,OCTOBER:10,NOV:11,NOVEMBER:11,DEC:12,DECEMBER:12 };

function pickLatest(rx) {
  const files = fs.readdirSync(INBOUND).filter(f => rx.test(f));
  if (!files.length) return null;
  files.sort((a,b) => fs.statSync(path.join(INBOUND,b)).mtimeMs - fs.statSync(path.join(INBOUND,a)).mtimeMs);
  return path.join(INBOUND, files[0]);
}

function monthFromSheetName(name) {
  const m = name.match(MONTH_PATTERN);
  if (!m) return null;
  const tok = m[1].toUpperCase();
  return MONTH_MAP[tok] || null;
}

// Convert ExcelJS cell value to { value, hyperlink }
function readCell(cell) {
  let v = cell.value;
  let url = null;
  if (cell.hyperlink) {
    if (typeof cell.hyperlink === 'string') url = cell.hyperlink;
    else if (cell.hyperlink && cell.hyperlink.target) url = cell.hyperlink.target;
  }
  if (v === null || v === undefined) return { value: '', hyperlink: url };
  if (typeof v === 'object') {
    if (v.hyperlink) { url = url || v.hyperlink; v = v.text ?? ''; }
    else if (v.richText) v = v.richText.map(t => t.text).join('');
    else if (v.formula !== undefined) v = (v.result !== undefined ? v.result : '');
    else if (v instanceof Date) v = v.toISOString().slice(0,10);
    else if (v.sharedFormula !== undefined) v = (v.result !== undefined ? v.result : '');
    else v = '';
  }
  if (typeof v === 'object' && v instanceof Date) v = v.toISOString().slice(0,10);
  if (v && typeof v === 'object' && 'error' in v) v = '';
  return { value: v ?? '', hyperlink: url };
}

function slug(s, idx) {
  const base = String(s||'').toLowerCase()
    .replace(/[\r\n]+/g,' ')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'') || `col_${idx}`;
  return base.slice(0,40);
}

// Detect header row: scan rows 1..5 and pick the first one with >=4 distinct
// short text cells (= real column headers, not the merged title row).
function detectHeaderRow(ws) {
  for (let r = 1; r <= 6; r++) {
    const row = ws.getRow(r);
    let textCells = 0;
    const seen = new Set();
    const lastCol = ws.actualColumnCount || 20;
    for (let c = 1; c <= lastCol; c++) {
      const { value } = readCell(row.getCell(c));
      const s = String(value || '').replace(/\s+/g,' ').trim();
      // Real header cells are short labels (NO, DATE, QTY, PRICE, ...)
      if (s && s.length <= 40) { textCells++; seen.add(s); }
    }
    // Need at least 4 distinct short labels to qualify as header row.
    if (textCells >= 4 && seen.size >= 4) return r;
  }
  return 2; // fallback
}

function inferHeader(ws) {
  const headerRowIdx = detectHeaderRow(ws);
  const headerRow = ws.getRow(headerRowIdx);
  const cols = [];
  const seen = new Set();
  const lastCol = ws.actualColumnCount || 20;
  for (let c = 1; c <= lastCol; c++) {
    const { value } = readCell(headerRow.getCell(c));
    const label = String(value || '').replace(/\s+/g,' ').trim();
    if (!label) continue;
    let key = slug(label, c);
    let suffix = 2;
    while (seen.has(key)) { key = slug(label, c) + '_' + suffix++; }
    seen.add(key);
    cols.push({ key, label_en: label, label_ko: label, colIndex: c, width: 120 });
  }
  return { cols, headerRowIdx };
}

async function processWorkbook(wbKey, filePath, supa) {
  console.log(`\n=== ${wbKey} ===\n  file: ${path.basename(filePath)}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // Collect month sheets
  const monthSheets = wb.worksheets.filter(s => monthFromSheetName(s.name));
  if (!monthSheets.length) { console.log('  no month sheets found'); return; }

  // Use JAN (or first) to infer columns
  const sample = monthSheets.find(s => monthFromSheetName(s.name) === 1) || monthSheets[0];
  const { cols, headerRowIdx } = inferHeader(sample);
  console.log(`  header@row ${headerRowIdx}, columns (${cols.length}):`, cols.map(c=>c.label_en).join(' | '));

  // Update workbook columns metadata
  const colsForDb = cols.map(({colIndex, ...rest}) => rest);
  if (!DRY) {
    const { error } = await supa.from('rm_workbooks').update({ columns: colsForDb }).eq('key', wbKey);
    if (error) throw new Error(`rm_workbooks update: ${error.message}`);
  }

  // Build rows per month sheet
  for (const ws of monthSheets) {
    const month = monthFromSheetName(ws.name);
    const rows = [];
    const lastRow = ws.rowCount;
    // Per-sheet header detection (some workbooks have header at row 2, some at row 3)
    const sheetHeaderRow = detectHeaderRow(ws);
    const dataStart = sheetHeaderRow + 1;
    for (let r = dataStart; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const data = {};
      const hyperlinks = {};
      let hasContent = false;
      for (const c of cols) {
        const { value, hyperlink } = readCell(row.getCell(c.colIndex));
        if (value !== '' && value !== null && value !== undefined) {
          data[c.key] = value;
          hasContent = true;
        }
        if (hyperlink) { hyperlinks[c.key] = hyperlink; hasContent = true; }
      }
      if (!hasContent) continue;
      rows.push({
        workbook_key: wbKey,
        year: YEAR,
        month,
        row_index: rows.length + 1,
        data,
        hyperlinks,
        source: 'excel',
      });
    }
    console.log(`  M${String(month).padStart(2,'0')} "${ws.name}" → ${rows.length} rows`);
    if (DRY || !rows.length) continue;
    // Delete existing excel-sourced rows for this workbook/month, then insert.
    const { error: delErr } = await supa
      .from('rm_monthly_rows')
      .delete()
      .eq('workbook_key', wbKey)
      .eq('year', YEAR)
      .eq('month', month)
      .eq('source', 'excel');
    if (delErr) throw new Error(`delete prev: ${delErr.message}`);

    // Insert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: insErr } = await supa.from('rm_monthly_rows').insert(chunk);
      if (insErr) throw new Error(`insert: ${insErr.message}`);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY && (!url || !svc)) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const supa = DRY ? null : createClient(url, svc, { auth: { persistSession: false } });

  const targets = ONLY ? WORKBOOKS.filter(w => w.key === ONLY) : WORKBOOKS;
  for (const w of targets) {
    const file = pickLatest(w.match);
    if (!file) { console.log(`\n=== ${w.key} ===\n  (no file matched)`); continue; }
    try {
      await processWorkbook(w.key, file, supa);
    } catch (e) {
      console.error(`  ERROR for ${w.key}:`, e.message);
    }
  }
  console.log(DRY ? '\n[dry-run] done.' : '\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
