#!/usr/bin/env node
// Import productivity workbook (생산성 집계) → Supabase
//   productivity_workbooks / productivity_monthly_rows
//
// We use the LATEST monthly file (26.4월 ...) because each new file is a
// rolling cumulative snapshot of the same B2:Y44 matrix with the newer
// month columns filled in. Earlier files are subsets.
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   source ~/.config/dsc-fms-secrets/supabase.env
//   node db/import-productivity.mjs
//   node db/import-productivity.mjs --dry
//   node db/import-productivity.mjs --file=/abs/path/26.4월_...xlsx
//
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const INBOUND = '/home/jeepney/.openclaw-dev/media/inbound';
const WB_KEY  = 'PROD-2026';
const YEAR    = 2026;
const DRY     = process.argv.includes('--dry');
const FILE_OVERRIDE = (process.argv.find(a => a.startsWith('--file=')) || '').split('=')[1] || null;

// Fixed column layout for B2:Y44 (24 columns)
// Excel col index → column metadata
const COLUMN_LAYOUT = [
  { col:  2, key: 'item',        label_en: 'Item',                 label_ko: '항목',                  group: 'meta',    width: 110 },
  { col:  3, key: 'div1',        label_en: 'Division',             label_ko: '구분',                  group: 'meta',    width: 110 },
  { col:  4, key: 'div2',        label_en: 'Sub-Division',         label_ko: '세부 구분',              group: 'meta',    width: 160 },
  { col:  5, key: 'name_en',     label_en: 'English Label',        label_ko: '영문',                  group: 'meta',    width: 200 },
  { col:  6, key: 'remark_pre',  label_en: 'Note',                 label_ko: '비고',                  group: 'note',    width: 140 },
  { col:  7, key: 'target_2026', label_en: '2026 Target',          label_ko: '2026년 생산성목표',       group: 'target',  width: 110 },
  { col:  8, key: 'y2025_m11',   label_en: '2025-11',              label_ko: '2025년 11월',           group: 'actual',  year: 2025, month: 11, width: 100 },
  { col:  9, key: 'y2025_m12',   label_en: '2025-12',              label_ko: '2025년 12월',           group: 'actual',  year: 2025, month: 12, width: 100 },
  { col: 10, key: 'y2026_m01',   label_en: '2026-01 JAN',          label_ko: '2026년 1월',            group: 'actual',  year: 2026, month:  1, width: 100 },
  { col: 11, key: 'y2026_m02',   label_en: '2026-02 FEB',          label_ko: '2026년 2월',            group: 'actual',  year: 2026, month:  2, width: 100 },
  { col: 12, key: 'y2026_m03',   label_en: '2026-03 MAR',          label_ko: '2026년 3월',            group: 'actual',  year: 2026, month:  3, width: 100 },
  { col: 13, key: 'y2026_m04',   label_en: '2026-04 APR',          label_ko: '2026년 4월',            group: 'actual',  year: 2026, month:  4, width: 100 },
  { col: 14, key: 'y2026_m05',   label_en: '2026-05 MAY',          label_ko: '2026년 5월',            group: 'actual',  year: 2026, month:  5, width: 100 },
  { col: 15, key: 'y2026_m06',   label_en: '2026-06 JUN',          label_ko: '2026년 6월',            group: 'actual',  year: 2026, month:  6, width: 100 },
  { col: 16, key: 'y2026_m07',   label_en: '2026-07 JUL',          label_ko: '2026년 7월',            group: 'actual',  year: 2026, month:  7, width: 100 },
  { col: 17, key: 'y2026_m08',   label_en: '2026-08 AUG',          label_ko: '2026년 8월',            group: 'actual',  year: 2026, month:  8, width: 100 },
  { col: 18, key: 'y2026_m09',   label_en: '2026-09 SEP',          label_ko: '2026년 9월',            group: 'actual',  year: 2026, month:  9, width: 100 },
  { col: 19, key: 'y2026_m10',   label_en: '2026-10 OCT',          label_ko: '2026년 10월',           group: 'actual',  year: 2026, month: 10, width: 100 },
  { col: 20, key: 'y2026_m11',   label_en: '2026-11 NOV',          label_ko: '2026년 11월',           group: 'actual',  year: 2026, month: 11, width: 100 },
  { col: 21, key: 'y2026_m12',   label_en: '2026-12 DEC',          label_ko: '2026년 12월',           group: 'actual',  year: 2026, month: 12, width: 100 },
  { col: 22, key: 'sum_2026',    label_en: '2026 Total',           label_ko: '2026년 합계',           group: 'summary', width: 120 },
  { col: 23, key: 'remark',      label_en: 'Remarks',              label_ko: '비고',                  group: 'note',    width: 200 },
  { col: 24, key: 'plan',        label_en: 'Improvement Plan',     label_ko: '비가동/LOSS 개선계획',     group: 'note',    width: 220 },
  { col: 25, key: 'standard',    label_en: 'Standard / Basis',     label_ko: '수립 기준',              group: 'note',    width: 200 },
];

function pickLatest() {
  if (FILE_OVERRIDE) return FILE_OVERRIDE;
  const files = fs.readdirSync(INBOUND)
    .filter(f => /^26\.[0-9]+월_만누르법인_생산성.*\.xlsx$/.test(f));
  if (!files.length) return null;
  // Sort by month number embedded in the name (26.<m>월)
  files.sort((a, b) => {
    const ma = parseInt((a.match(/^26\.(\d+)월/) || [])[1] || '0', 10);
    const mb = parseInt((b.match(/^26\.(\d+)월/) || [])[1] || '0', 10);
    if (ma !== mb) return mb - ma;
    return fs.statSync(path.join(INBOUND, b)).mtimeMs - fs.statSync(path.join(INBOUND, a)).mtimeMs;
  });
  return path.join(INBOUND, files[0]);
}

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
    else if (v.formula !== undefined || v.sharedFormula !== undefined) {
      const r = v.result;
      if (r && typeof r === 'object' && 'error' in r) v = '';
      else v = (r !== undefined ? r : '');
    }
    else if (v instanceof Date) v = v.toISOString().slice(0,10);
    else if ('error' in v) v = '';
    else v = '';
  }
  if (v instanceof Date) v = v.toISOString().slice(0,10);
  return { value: v ?? '', hyperlink: url };
}

// Detect row_type heuristically from row content
function detectRowType(item, div1, div2) {
  const s = `${item} ${div1} ${div2}`;
  if (/소계|합계|소\s*계|sub\s*total/i.test(s)) return 'subtotal';
  if (/비율|ratio/i.test(s)) return 'ratio';
  if (/생산효율/.test(item) && /생산효율/.test(div1)) return 'summary';
  return 'data';
}

async function processFile(filePath, supa) {
  console.log(`\nFile: ${path.basename(filePath)}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets.find(s => /생산성/.test(s.name)) || wb.worksheets[0];
  if (!ws) throw new Error('No worksheet found');
  console.log(`Sheet: "${ws.name}" rows=${ws.rowCount}`);

  // Push column metadata to workbook
  const colsForDb = COLUMN_LAYOUT.map(({ col, ...rest }) => rest);
  if (!DRY) {
    const { error } = await supa.from('productivity_workbooks')
      .update({ columns: colsForDb, year: YEAR })
      .eq('key', WB_KEY);
    if (error) throw new Error(`workbook update: ${error.message}`);
  }

  // Data rows: B5:Y43 (rows 5..43)
  const ROW_START = 5;
  const ROW_END   = 43;
  const rows = [];
  for (let r = ROW_START; r <= ROW_END; r++) {
    const row = ws.getRow(r);
    const data = {};
    const hyperlinks = {};
    let hasContent = false;
    for (const c of COLUMN_LAYOUT) {
      const { value, hyperlink } = readCell(row.getCell(c.col));
      if (value !== '' && value !== null && value !== undefined) {
        data[c.key] = value;
        hasContent = true;
      }
      if (hyperlink) { hyperlinks[c.key] = hyperlink; hasContent = true; }
    }
    if (!hasContent) continue;
    const row_type = detectRowType(
      String(data.item || ''),
      String(data.div1 || ''),
      String(data.div2 || ''),
    );
    rows.push({
      workbook_key: WB_KEY,
      row_index: rows.length + 1,
      row_type,
      data,
      hyperlinks,
      source: 'excel',
    });
  }
  console.log(`Parsed ${rows.length} data rows`);

  if (DRY) {
    console.log('[dry-run] sample row:', JSON.stringify(rows[0], null, 2));
    console.log('[dry-run] last row:',   JSON.stringify(rows[rows.length-1], null, 2));
    return;
  }

  // Replace existing excel-sourced rows
  const { error: delErr } = await supa
    .from('productivity_monthly_rows')
    .delete()
    .eq('workbook_key', WB_KEY)
    .eq('source', 'excel');
  if (delErr) throw new Error(`delete prev: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supa.from('productivity_monthly_rows').insert(chunk);
    if (error) throw new Error(`insert: ${error.message}`);
  }
  console.log(`Inserted ${rows.length} rows.`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY && (!url || !svc)) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const supa = DRY ? null : createClient(url, svc, { auth: { persistSession: false } });

  const file = pickLatest();
  if (!file) { console.error('No productivity Excel file found.'); process.exit(1); }
  await processFile(file, supa);
  console.log(DRY ? '\n[dry-run] done.' : '\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
