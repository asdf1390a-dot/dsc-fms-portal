// POST /api/reports/quality/chunk-upload
// Body: multipart/form-data — chunk transfer protocol
//   Required fields (every request):
//     - upload_id:    client-generated session id (uuid-ish string)
//     - file_key:     one of "prev_excel" | "prev_ppt" | "data_excel"
//     - chunk_index:  0-based chunk number for this file
//     - total_chunks: total chunks for this file
//     - file_name:    original filename (used on last chunk)
//     - chunk:        binary blob (≤ 4 MB recommended)
//
//   Finalize request (after all chunks of all files uploaded):
//     - upload_id
//     - finalize:     "true"
//     - target_month: "YYYY-MM-01"
//     (no chunk binary)
//
// Why: Vercel free tier rejects request bodies > 4.5 MB. The standard
// /api/reports/quality/generate flow sends ~50 MB at once and 413s.
// Here we slice client-side to ≤4 MB chunks, persist to /tmp on the
// serverless instance, then run the same processing pipeline on finalize.
//
// Caveat: Vercel serverless instances are not sticky. Chunks for the
// same upload_id may land on different instances. We mitigate by:
//   - persisting to /tmp (per-instance) — works when warm instance is reused
//   - if a chunk arrives on a fresh instance, files reassemble incrementally
//     and finalize will still find whatever made it to *that* instance's /tmp
// Best-effort. If reassembly fails we return a clear error so the client
// can retry the whole flow. For 3 files × ~10 chunks each, sequential
// upload typically keeps the same warm instance.

import fs from 'fs';
import path from 'path';
import os from 'os';
import formidable from 'formidable';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { processQualityExcel } from '../../../../lib/reports/excel-processor';
import { processQualityPpt } from '../../../../lib/reports/ppt-processor';

export const config = {
  api: {
    bodyParser: false,
    // formidable handles size; each chunk is ≤ ~5 MB
    sizeLimit: '6mb',
  },
};

const BUCKET = 'quality-reports';
const FILE_KEYS = ['prev_excel', 'prev_ppt', 'data_excel'];

function tmpRoot() {
  return path.join(os.tmpdir(), 'quality-chunks');
}
function sessionDir(uploadId) {
  // sanitize: keep only safe chars
  const safe = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safe) throw new Error('bad upload_id');
  return path.join(tmpRoot(), safe);
}
function fileChunkDir(uploadId, fileKey) {
  if (!FILE_KEYS.includes(fileKey)) throw new Error('bad file_key');
  return path.join(sessionDir(uploadId), fileKey);
}

async function parseMultipart(req) {
  const form = formidable({
    maxFileSize: 8 * 1024 * 1024, // single chunk cap
    multiples: false,
    keepExtensions: false,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function one(v) {
  if (v === undefined || v === null) return null;
  return Array.isArray(v) ? v[0] : v;
}

function parseMonthString(s) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(s || ''));
  if (!m) return null;
  return { year: +m[1], month: +m[2] };
}
function prevMonthOf({ year, month }) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function reassemble(uploadId, fileKey) {
  const dir = fileChunkDir(uploadId, fileKey);
  if (!fs.existsSync(dir)) throw new Error(`missing_chunks:${fileKey}`);
  const entries = fs.readdirSync(dir)
    .filter(n => /^\d+\.bin$/.test(n))
    .map(n => ({ name: n, idx: parseInt(n, 10) }))
    .sort((a, b) => a.idx - b.idx);
  if (entries.length === 0) throw new Error(`no_chunks:${fileKey}`);

  // Verify contiguous 0..N-1
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].idx !== i) {
      throw new Error(`chunk_gap:${fileKey}:expected_${i}_got_${entries[i].idx}`);
    }
  }
  const bufs = entries.map(e => fs.readFileSync(path.join(dir, e.name)));
  return Buffer.concat(bufs);
}

function cleanupSession(uploadId) {
  try {
    const dir = sessionDir(uploadId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
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

  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (e) {
    return res.status(400).json({ error: 'multipart_parse_failed', detail: String(e.message || e) });
  }

  const uploadId = one(fields.upload_id);
  if (!uploadId) return res.status(400).json({ error: 'missing_upload_id' });

  const finalize = one(fields.finalize) === 'true';

  // ── Chunk receive path ──
  if (!finalize) {
    const fileKey = one(fields.file_key);
    const chunkIndex = parseInt(one(fields.chunk_index) || '-1', 10);
    const totalChunks = parseInt(one(fields.total_chunks) || '-1', 10);
    if (!FILE_KEYS.includes(fileKey)) return res.status(400).json({ error: 'bad_file_key' });
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) return res.status(400).json({ error: 'bad_chunk_index' });
    if (!Number.isFinite(totalChunks) || totalChunks <= 0) return res.status(400).json({ error: 'bad_total_chunks' });

    const chunkF = Array.isArray(files.chunk) ? files.chunk[0] : files.chunk;
    if (!chunkF) return res.status(400).json({ error: 'missing_chunk' });

    let dir;
    try { dir = fileChunkDir(uploadId, fileKey); }
    catch (e) { return res.status(400).json({ error: String(e.message) }); }
    fs.mkdirSync(dir, { recursive: true });

    const dest = path.join(dir, `${chunkIndex}.bin`);
    try {
      fs.copyFileSync(chunkF.filepath, dest);
    } catch (e) {
      return res.status(500).json({ error: 'chunk_write_failed', detail: String(e.message || e) });
    } finally {
      try { fs.unlinkSync(chunkF.filepath); } catch (_) {}
    }

    // Persist file_name on first chunk for diagnostics
    if (chunkIndex === 0) {
      const fileName = one(fields.file_name) || '';
      try {
        fs.writeFileSync(path.join(dir, '_name.txt'), String(fileName).slice(0, 255));
      } catch (_) {}
    }

    return res.status(200).json({
      ok: true,
      upload_id: uploadId,
      file_key: fileKey,
      chunk_index: chunkIndex,
      received: fs.readdirSync(dir).filter(n => /^\d+\.bin$/.test(n)).length,
      total_chunks: totalChunks,
    });
  }

  // ── Finalize path: reassemble + process + upload ──
  const targetMonthStr = one(fields.target_month);
  const tm = parseMonthString(targetMonthStr);
  if (!tm) return res.status(400).json({ error: 'bad_target_month' });
  const cur = tm;
  const prev = prevMonthOf(tm);

  // Read original filenames from _name.txt (if present)
  function nameFor(fk) {
    try {
      const p = path.join(fileChunkDir(uploadId, fk), '_name.txt');
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch (_) {}
    return `${fk}.bin`;
  }

  const prevExcelName = nameFor('prev_excel');
  const prevPptName   = nameFor('prev_ppt');
  const dataExcelName = nameFor('data_excel');

  // History row
  const { data: hist, error: histErr } = await supabaseAdmin
    .from('quality_report_history')
    .insert({
      target_month: targetMonthStr,
      input_prev_excel_name: prevExcelName,
      input_prev_ppt_name:   prevPptName,
      input_data_name:       dataExcelName,
      status: 'processing',
      created_by: userId,
    })
    .select('id')
    .single();
  if (histErr) {
    cleanupSession(uploadId);
    return res.status(500).json({ error: 'history_insert_failed', detail: histErr.message });
  }
  const historyId = hist.id;

  try {
    const prevExcelBuf = reassemble(uploadId, 'prev_excel');
    const prevPptBuf   = reassemble(uploadId, 'prev_ppt');
    const rawDataBuf   = reassemble(uploadId, 'data_excel');

    const outExcelBuf = await processQualityExcel({
      prevExcelBuf,
      rawDataBuf,
      prevMonth: prev.month,
      curMonth: cur.month,
    });
    const outPptBuf = await processQualityPpt({
      prevPptBuf,
      prevMonth: prev.month,
      curMonth: cur.month,
    });

    const stamp = Date.now();
    const monthTag = `${cur.year}-${String(cur.month).padStart(2, '0')}`;
    const excelName = `품질월보고서_${monthTag}.xlsx`;
    const pptName   = `월간품질현황_${monthTag}.pptx`;
    const excelKey  = `${monthTag}/${stamp}_${historyId}_excel.xlsx`;
    const pptKey    = `${monthTag}/${stamp}_${historyId}_ppt.pptx`;

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

    await supabaseAdmin.from('quality_report_history').update({
      output_excel_path: excelKey,
      output_ppt_path:   pptKey,
      output_excel_name: excelName,
      output_ppt_name:   pptName,
      status: 'done',
    }).eq('id', historyId);

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
    cleanupSession(uploadId);
  }
}
