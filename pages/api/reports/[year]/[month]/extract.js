// /api/reports/[year]/[month]/extract
// POST multipart/form-data
// type=quality  → file (Korea Report xlsx) → 품질 데이터 추출
// type=production → file_production (생산현황.xlsx) + file_summary (생산성집계.xlsx) → 생산성 데이터 추출
import fs from 'fs';
import formidable from 'formidable';
import * as XLSX from 'xlsx';
import { getUserFromRequest } from '../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const config = {
  api: { bodyParser: false },
  maxDuration: 120,
};

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true, maxFileSize: 200 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function getFile(files, key) {
  const entry = files?.[key];
  return Array.isArray(entry) ? entry[0] : entry;
}

function getField(fields, key) {
  const v = fields?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function readWb(file) {
  const buf = fs.readFileSync(file.filepath || file.path);
  return XLSX.read(buf, { type: 'buffer' });
}

function cleanup(...files) {
  for (const f of files) {
    if (f) try { fs.unlinkSync(f.filepath || f.path); } catch (_) {}
  }
}

function safeNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return null; // formula error cell (#DIV/0! etc.)
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function sheetToRows(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

// ─── 품질 추출 (기존) ─────────────────────────────────────────────────────────
function findNumeric(rows, labelRegex) {
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== 'string') continue;
      if (!labelRegex.test(cell)) continue;
      for (let k = c + 1; k < row.length; k++) {
        const v = row[k];
        if (v === null || v === undefined || v === '') continue;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
        if (!isNaN(n)) return n;
      }
    }
  }
  return null;
}

function findSheet(wb, candidates) {
  const names = wb.SheetNames || [];
  for (const cand of candidates) {
    const re = cand instanceof RegExp ? cand : new RegExp(cand, 'i');
    const hit = names.find((n) => re.test(n));
    if (hit) return wb.Sheets[hit];
  }
  return null;
}

async function handleQuality(res, year, month, files, user) {
  const file = getFile(files, 'file');
  if (!file) return res.status(400).json({ error: 'file field required' });

  let wb;
  try { wb = readWb(file); } catch (e) {
    cleanup(file);
    return res.status(400).json({ error: 'xlsx parse failed: ' + e.message });
  }

  const monthAbbr = MONTH_ABBR[month - 1];
  const yy = String(year).slice(-2);

  const wsClaim    = findSheet(wb, [/claim/i, /scrap/i, /debit/i]);
  const wsPpm      = findSheet(wb, [/ppm/i]);
  const wsInProc   = findSheet(wb, [new RegExp(`INPROCESS.*${monthAbbr}.*${yy}`, 'i'), /INPROCESS/i]);
  const wsIncoming = findSheet(wb, [new RegExp(`INCOMING.*${monthAbbr}.*${yy}`, 'i'), /INCOMING/i]);

  const claimRows    = sheetToRows(wsClaim);
  const ppmRows      = sheetToRows(wsPpm);
  const inProcRows   = sheetToRows(wsInProc);
  const incomingRows = sheetToRows(wsIncoming);

  const extracted = {
    customer_ppm    : findNumeric(ppmRows,   /customer|client|고객/i),
    customer_count  : findNumeric(claimRows, /customer.*(qty|count|cases|건)|claim.*(qty|count)/i),
    inprocess_count : findNumeric(inProcRows, /(total|sum|합계)/i) ?? findNumeric(inProcRows, /reject|불량/i),
    inprocess_ppm   : findNumeric(ppmRows,   /inprocess|in[-\s]?process|공정/i),
    incoming_count  : findNumeric(incomingRows, /(total|sum|합계)/i) ?? findNumeric(incomingRows, /reject|불량/i),
    incoming_ppm    : findNumeric(ppmRows,   /incoming|입고/i),
    claim_cost      : findNumeric(claimRows, /claim.*(cost|amount|amt|금액)/i),
    scrap_cost      : findNumeric(claimRows, /scrap.*(cost|amount|amt|금액)/i),
  };

  const qualityPatch = {};
  for (const [k, v] of Object.entries(extracted)) {
    if (v !== null && v !== undefined && !isNaN(v)) qualityPatch[k] = v;
  }

  const { data: existing } = await supabaseAdmin
    .from('management_reports').select('quality').eq('year', year).eq('month', month).maybeSingle();

  const mergedQuality = { ...(existing?.quality || {}), ...qualityPatch };
  const sourceFile = {
    filename: file.originalFilename || file.newFilename || 'upload.xlsx',
    size: file.size || 0,
    uploaded_at: new Date().toISOString(),
    sheets_found: { claim: !!wsClaim, ppm: !!wsPpm, inprocess: !!wsInProc, incoming: !!wsIncoming },
  };

  const { data, error } = await supabaseAdmin
    .from('management_reports')
    .upsert({ year, month, quality: mergedQuality, source_file: sourceFile }, { onConflict: 'year,month' })
    .select().single();

  cleanup(file);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({
    item: data, extracted: qualityPatch,
    missing: Object.keys(extracted).filter((k) => qualityPatch[k] === undefined),
    sheets_found: sourceFile.sheets_found,
  });
}

// ─── 생산성 추출 ──────────────────────────────────────────────────────────────

// 생산성집계 시트에서 target year/month의 컬럼 인덱스(0-based)
// 구조: col7=25년11월, col8=25년12월, col9=26년1월, col10=26년2월, ...
function getSummaryColIdx(year, month) {
  if (year === 2025 && month === 11) return 7;
  if (year === 2025 && month === 12) return 8;
  if (year === 2026 && month >= 1 && month <= 12) return 8 + month;
  return null;
}

async function handleProduction(res, year, month, files) {
  const prodFile = getFile(files, 'file_production');
  const sumFile  = getFile(files, 'file_summary');

  if (!prodFile) return res.status(400).json({ error: 'file_production 필드 필요 (생산현황.xlsx)' });
  if (!sumFile)  return res.status(400).json({ error: 'file_summary 필드 필요 (생산성집계.xlsx)' });

  let wbProd, wbSum;
  try {
    wbProd = readWb(prodFile);
    wbSum  = readWb(sumFile);
  } catch (e) {
    cleanup(prodFile, sumFile);
    return res.status(400).json({ error: 'xlsx 파싱 실패: ' + e.message });
  }

  // ── 생산현황 Sheet1: 차종별 계획/실적/달성률 ──
  const wsProd = wbProd.Sheets['Sheet1'] ?? wbProd.Sheets[wbProd.SheetNames[0]];
  const prodRows = sheetToRows(wsProd);
  // 헤더 행 구조: col2=Car type, col4=Item, col5=Total, col6=Jan, col7=Feb, ... col(5+month)=target month
  const prodMonthCol = 5 + month;

  const modelMap = {};
  for (const row of prodRows) {
    if (!row || row.length < 6) continue;
    const model = row[2];
    const item = String(row[4] ?? '').toLowerCase().trim();
    if (!model || !item) continue;
    if (!['plan', 'actual', 'ratio'].includes(item)) continue;
    if (!modelMap[model]) modelMap[model] = { model };
    const val = safeNum(row[prodMonthCol]);
    if (item === 'plan')   modelMap[model].plan   = val;
    if (item === 'actual') modelMap[model].actual  = val;
    if (item === 'ratio')  modelMap[model].ratio   = val;
  }
  const byModel = Object.values(modelMap).filter(m => m.plan != null || m.actual != null);

  // ── 생산성집계 시트: 생산효율 & 비가동시간 ──
  const wsSum = wbSum.Sheets['생산성 집계'] ?? wbSum.Sheets[wbSum.SheetNames[0]];
  const sumRows = sheetToRows(wsSum);
  const colIdx = getSummaryColIdx(year, month);

  if (colIdx === null) {
    cleanup(prodFile, sumFile);
    return res.status(400).json({ error: `지원하지 않는 연월: ${year}년 ${month}월` });
  }

  const g = (rowIdx) => safeNum(sumRows[rowIdx]?.[colIdx]);

  const productionData = {
    byModel,
    직접인원:   g(3),
    표준시간:   g(4),
    종합생산성: g(5),
    투입시간:   g(6),
    인정비가동: {
      작업자교육:    g(7),
      안전교육:      g(8),
      청소시간:      g(9),
      용접와이어교체: g(10),
      팁교체:        g(11),
      신차작업지원:  g(12),
      계획비가동:    g(13),
      고객사라인정지: g(14),
      지그교환:      g(15),
      금형교환:      g(16),
      타부서지원:    g(17),
      정전:          g(18),
      소계:          g(19),
      비율:          g(20),
    },
    개선비가동: {
      장비고장:      g(21),
      지그고장:      g(22),
      센서고장:      g(23),
      바코드이상:    g(24),
      서보이상:      g(25),
      공급자품질문제: g(26),
      공급자결품:    g(27),
      공정품질문제:  g(28),
      공정결품:      g(29),
      공정품피딩지연: g(30),
      고객품질문제:  g(31),
      납품용기결품:  g(32),
      작업자결원:    g(33),
      로보트티칭수정: g(34),
      금형수리:      g(35),
      // row 36 blank
      소계:          g(37),
      비율:          g(38),
    },
    loss: {
      소계: g(39),
      비율: g(40),
    },
    생산효율: g(41),
  };

  const { error } = await supabaseAdmin
    .from('management_reports')
    .upsert({ year, month, production: productionData }, { onConflict: 'year,month' });

  cleanup(prodFile, sumFile);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ extracted: productionData });
}

// ─── 메인 핸들러 ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'invalid year/month' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  let parsed;
  try { parsed = await parseForm(req); } catch (e) {
    return res.status(400).json({ error: 'form parse failed: ' + e.message });
  }

  const type = getField(parsed.fields, 'type') || '';

  if (type === 'production') {
    return handleProduction(res, year, month, parsed.files);
  }
  return handleQuality(res, year, month, parsed.files, user);
}
