// POST /api/reports/quality/generate
// Body: multipart/form-data
//   - target_month: "YYYY-MM-01"
//   - prev_excel:   .xlsx (previous month completed)
//   - prev_ppt:     .pptx (previous month completed)
//   - data_excel:   .xlsx (current month raw Korea Report)
// Response: { id, excel_url, ppt_url }
//
// Auth: Bearer Supabase JWT
// Storage bucket: quality-reports (private, server-only via service_role)

import fs from 'fs';
import formidable from 'formidable';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { processQualityExcel } from '../../../../lib/reports/excel-processor';
import { processQualityPpt } from '../../../../lib/reports/ppt-processor';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

const BUCKET = 'quality-reports';

function parseMonthString(s) {
  // "YYYY-MM-01" → { year, month (1..12) }
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(s || ''));
  if (!m) return null;
  return { year: +m[1], month: +m[2] };
}

function prevMonthOf({ year, month }) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

async function parseMultipart(req) {
  const form = formidable({
    maxFileSize: 200 * 1024 * 1024,
    multiples: false,
    keepExtensions: true,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function singleFile(f) {
  if (!f) return null;
  return Array.isArray(f) ? f[0] : f;
}
function singleField(v) {
  if (v === undefined || v === null) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Auth
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { data: who, error: whoErr } = await supabaseAdmin.auth.getUser(token);
  if (whoErr || !who?.user) return res.status(401).json({ error: 'invalid_token' });
  const userId = who.user.id;

  // Parse multipart
  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (e) {
    return res.status(400).json({ error: 'multipart_parse_failed', detail: String(e.message || e) });
  }

  const targetMonthStr = singleField(fields.target_month);
  const tm = parseMonthString(targetMonthStr);
  if (!tm) return res.status(400).json({ error: 'bad_target_month' });

  const rollingWindowSize = parseInt(singleField(fields.rolling_window_size) || '3', 10);
  if (!Number.isFinite(rollingWindowSize) || rollingWindowSize < 1 || rollingWindowSize > 12) {
    return res.status(400).json({ error: 'bad_rolling_window_size' });
  }

  const prevExcelF = singleFile(files.prev_excel);
  const prevPptF   = singleFile(files.prev_ppt);
  const dataExcelF = singleFile(files.data_excel);
  if (!prevExcelF || !prevPptF || !dataExcelF) {
    return res.status(400).json({ error: 'missing_files' });
  }

  const cur  = tm;
  const prev = prevMonthOf(tm);

  // Create history row early (status=processing) for diagnostic
  const { data: hist, error: histErr } = await supabaseAdmin
    .from('quality_report_history')
    .insert({
      target_month: targetMonthStr,
      input_prev_excel_name: prevExcelF.originalFilename,
      input_prev_ppt_name:   prevPptF.originalFilename,
      input_data_name:       dataExcelF.originalFilename,
      status: 'processing',
      created_by: userId,
    })
    .select('id')
    .single();
  if (histErr) return res.status(500).json({ error: 'history_insert_failed', detail: histErr.message });
  const historyId = hist.id;

  try {
    const prevExcelBuf = fs.readFileSync(prevExcelF.filepath);
    const prevPptBuf   = fs.readFileSync(prevPptF.filepath);
    const rawDataBuf   = fs.readFileSync(dataExcelF.filepath);

    // ── Excel ──
    const outExcelBuf = await processQualityExcel({
      prevExcelBuf,
      rawDataBuf,
      prevMonth: prev.month,
      curMonth: cur.month,
      rollingWindowSize,
    });
    // ── PPT ──
    const outPptBuf = await processQualityPpt({
      prevPptBuf,
      prevMonth: prev.month,
      curMonth: cur.month,
      rollingWindowSize,
    });

    const stamp = Date.now();
    const monthTag = `${cur.year}-${String(cur.month).padStart(2, '0')}`;
    const excelName = `품질월보고서_${monthTag}.xlsx`;
    const pptName   = `월간품질현황_${monthTag}.pptx`;
    const excelKey  = `${monthTag}/${stamp}_${historyId}_excel.xlsx`;
    const pptKey    = `${monthTag}/${stamp}_${historyId}_ppt.pptx`;

    // Upload
    const upE = await supabaseAdmin.storage.from(BUCKET).upload(excelKey, outExcelBuf, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });
    if (upE.error) throw new Error('excel_upload: ' + upE.error.message);

    const upP = await supabaseAdmin.storage.from(BUCKET).upload(pptKey, outPptBuf, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: false,
    });
    if (upP.error) throw new Error('ppt_upload: ' + upP.error.message);

    // Update history
    await supabaseAdmin.from('quality_report_history').update({
      output_excel_path: excelKey,
      output_ppt_path:   pptKey,
      output_excel_name: excelName,
      output_ppt_name:   pptName,
      status: 'done',
    }).eq('id', historyId);

    // Signed URLs (10 min)
    const sE = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(excelKey, 600, { download: excelName });
    const sP = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(pptKey,   600, { download: pptName });

    return res.status(200).json({
      id: historyId,
      target_month: targetMonthStr,
      excel: { url: sE.data?.signedUrl, filename: excelName, path: excelKey },
      ppt:   { url: sP.data?.signedUrl, filename: pptName,   path: pptKey   },
    });
  } catch (e) {
    const msg = String(e?.message || e);
    await supabaseAdmin.from('quality_report_history').update({
      status: 'error', error_msg: msg.slice(0, 500),
    }).eq('id', historyId);
    return res.status(500).json({ error: 'processing_failed', detail: msg });
  } finally {
    // cleanup tmp
    try { fs.unlinkSync(prevExcelF.filepath); } catch (_) {}
    try { fs.unlinkSync(prevPptF.filepath); } catch (_) {}
    try { fs.unlinkSync(dataExcelF.filepath); } catch (_) {}
  }
}
