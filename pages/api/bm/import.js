import fs from 'fs';
import formidable from 'formidable';
import * as XLSX from 'xlsx';
import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 120,
};

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

  // Get user
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const sb = userScopedClient(token);

  // Parse multipart (read file)
  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (e) {
    return res.status(400).json({ error: 'multipart_parse_failed', detail: String(e.message || e) });
  }

  const file = singleFile(files.file);
  if (!file) return res.status(400).json({ error: 'missing_file' });

  // Read file buffer
  const fileBuffer = fs.readFileSync(file.filepath);

  // Parse Excel
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'excel_parse_failed', detail: String(e) });
  }

  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return res.status(400).json({ error: 'no_sheets' });

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  if (rows.length === 0) return res.status(400).json({ error: 'no_data' });

  // Transform rows into BM record format
  // Expected columns: asset_id, reported_at, severity, priority, symptom, symptom_ta, cause_code, reporter_name
  const records = rows
    .filter(row => row.asset_id) // Skip rows without asset_id
    .map(row => ({
      asset_id: row.asset_id,
      reported_at: row.reported_at ? new Date(row.reported_at).toISOString() : new Date().toISOString(),
      reporter_name: row.reporter_name || null,
      reported_by: user.id,
      severity: row.severity || 'normal',
      priority: row.priority || 'medium',
      symptom: row.symptom || null,
      symptom_ta: row.symptom_ta || null,
      cause_code: row.cause_code || null,
      cause: row.cause || null,
      status: 'open',
      downtime_start: row.downtime_start ? new Date(row.downtime_start).toISOString() : null,
      downtime_end: null,
      work_hours: null,
      technician_id: null,
      action_taken: null,
      photos: [],
    }));

  if (records.length === 0) return res.status(400).json({ error: 'no_valid_records' });

  // Insert into database
  const { data: inserted, error } = await sb
    .from('bm_events')
    .insert(records)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Cleanup temp file
  try {
    fs.unlinkSync(file.filepath);
  } catch (e) {
    // Ignore cleanup errors
  }

  return res.json({
    imported: inserted?.length || 0,
    items: inserted || [],
  });
}
