// /api/reports/[year]/[month]/extract
// POST multipart/form-data — 1번 파일(xlsx) 업로드 → 품질 데이터 추출 → quality merge PATCH
import fs from 'fs';
import formidable from 'formidable';
import * as XLSX from 'xlsx';
import { getUserFromRequest } from '../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const config = { api: { bodyParser: false } };

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 30 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

// 시트 데이터에서 키워드(label) 옆 셀의 숫자 값 탐색.
// 같은 행에서 label 다음 비어있지 않은 숫자 셀을 반환.
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

// 시트명 후보 검색 (월/연도 가변)
function findSheet(wb, candidates) {
  const names = wb.SheetNames || [];
  for (const cand of candidates) {
    const re = cand instanceof RegExp ? cand : new RegExp(cand, 'i');
    const hit = names.find((n) => re.test(n));
    if (hit) return wb.Sheets[hit];
  }
  return null;
}

function sheetToRows(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'invalid year/month' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  let parsed;
  try {
    parsed = await parseForm(req);
  } catch (e) {
    return res.status(400).json({ error: 'form parse failed: ' + e.message });
  }

  const fileEntry = parsed.files?.file;
  const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
  if (!file) return res.status(400).json({ error: 'file field required' });

  let wb;
  try {
    const buf = fs.readFileSync(file.filepath || file.path);
    wb = XLSX.read(buf, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'xlsx parse failed: ' + e.message });
  }

  const monthAbbr = MONTH_ABBR[month - 1];
  const yy = String(year).slice(-2);

  // 후보 시트 선택
  const wsClaim = findSheet(wb, [/claim/i, /scrap/i, /debit/i]);
  const wsPpm   = findSheet(wb, [/ppm/i]);
  const wsInProc = findSheet(wb, [
    new RegExp(`INPROCESS.*${monthAbbr}.*${yy}`, 'i'),
    /INPROCESS/i,
  ]);
  const wsIncoming = findSheet(wb, [
    new RegExp(`INCOMING.*${monthAbbr}.*${yy}`, 'i'),
    /INCOMING/i,
  ]);

  const claimRows    = sheetToRows(wsClaim);
  const ppmRows      = sheetToRows(wsPpm);
  const inProcRows   = sheetToRows(wsInProc);
  const incomingRows = sheetToRows(wsIncoming);

  // 휴리스틱 추출 (실패시 null)
  const extracted = {
    customer_ppm    : findNumeric(ppmRows,   /customer|client|고객/i),
    customer_count  : findNumeric(claimRows, /customer.*(qty|count|cases|건)|claim.*(qty|count)/i),
    inprocess_count : findNumeric(inProcRows, /(total|sum|합계)/i)
                     ?? findNumeric(inProcRows, /reject|불량/i),
    inprocess_ppm   : findNumeric(ppmRows,   /inprocess|in[-\s]?process|공정/i),
    incoming_count  : findNumeric(incomingRows, /(total|sum|합계)/i)
                     ?? findNumeric(incomingRows, /reject|불량/i),
    incoming_ppm    : findNumeric(ppmRows,   /incoming|입고/i),
    claim_cost      : findNumeric(claimRows, /claim.*(cost|amount|amt|금액)/i),
    scrap_cost      : findNumeric(claimRows, /scrap.*(cost|amount|amt|금액)/i),
  };

  // null 항목 제거 → null만 있으면 빈 객체
  const qualityPatch = {};
  for (const [k, v] of Object.entries(extracted)) {
    if (v !== null && v !== undefined && !isNaN(v)) qualityPatch[k] = v;
  }

  // 기존 row 가져와서 quality merge
  const { data: existing } = await supabaseAdmin
    .from('management_reports')
    .select('quality, source_file')
    .eq('year', year).eq('month', month)
    .maybeSingle();

  const mergedQuality = { ...(existing?.quality || {}), ...qualityPatch };
  const sourceFile = {
    filename: file.originalFilename || file.newFilename || 'upload.xlsx',
    size: file.size || 0,
    uploaded_at: new Date().toISOString(),
    sheets_found: {
      claim: !!wsClaim, ppm: !!wsPpm,
      inprocess: !!wsInProc, incoming: !!wsIncoming,
    },
  };

  const { data, error } = await supabaseAdmin
    .from('management_reports')
    .upsert(
      { year, month, quality: mergedQuality, source_file: sourceFile },
      { onConflict: 'year,month' }
    )
    .select().single();

  // 임시 파일 정리
  try { fs.unlinkSync(file.filepath || file.path); } catch (_) {}

  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    item: data,
    extracted: qualityPatch,
    missing: Object.keys(extracted).filter((k) => qualityPatch[k] === undefined),
    sheets_found: sourceFile.sheets_found,
  });
}
