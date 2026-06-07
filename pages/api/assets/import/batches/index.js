// /api/assets/import/batches
//   POST — Create new import batch (multipart/form-data: file, batch_name)
//   GET  — List batches (query: status, limit, offset)
//
// Auth: Bearer JWT (requireUser).
// Asset Master v2 Phase 2 — batch lifecycle endpoints.

import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireUser } from '../../../../../lib/career-auth';

export const config = {
  api: { bodyParser: false },
};

const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed'];

export default async function handler(req, res) {
  if (req.method === 'POST') return handleCreate(req, res);
  if (req.method === 'GET') return handleList(req, res);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function handleList(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const status = req.query.status;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

  try {
    let q = supabaseAdmin
      .from('asset_import_batches')
      .select(
        'id, batch_name, batch_date, file_name, file_size_bytes, status, total_rows, processed_count, success_count, error_count, org_id, created_at, created_by, updated_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'invalid_status', message: `status must be one of ${VALID_STATUSES.join(', ')}` });
      }
      q = q.eq('status', status);
    }

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      batches: data || [],
      total: count ?? 0,
      limit,
      offset,
      user_id: user.id,
    });
  } catch (e) {
    return res.status(500).json({ error: 'list_failed', message: e.message });
  }
}

async function handleCreate(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const form = new IncomingForm({
    maxFileSize: 5 * 1024 * 1024,
    keepExtensions: true,
  });

  let fields;
  let files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    return res.status(400).json({ error: 'file_parse_failed', message: e.message });
  }

  const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!uploadedFile) {
    return res.status(400).json({ error: 'no_file', message: '"file" 필드가 없습니다' });
  }

  const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();
  if (!['.csv', '.xls', '.xlsx'].includes(ext)) {
    return res.status(400).json({
      error: 'unsupported_format',
      message: 'CSV 또는 Excel 파일만 지원합니다 (.csv, .xls, .xlsx)',
    });
  }

  const batchNameRaw = Array.isArray(fields.batch_name) ? fields.batch_name[0] : fields.batch_name;
  const batchName =
    (batchNameRaw && String(batchNameRaw).trim()) ||
    `import_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

  let buffer;
  try {
    buffer = fs.readFileSync(uploadedFile.filepath);
  } catch (e) {
    return res.status(500).json({ error: 'file_read_failed', message: e.message });
  }

  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Parse & validate via inline validator (mirrors /validate)
  let result;
  try {
    const XLSX = require('xlsx');
    result = parseAndValidate(XLSX, buffer, uploadedFile.originalFilename || 'upload');
  } catch (e) {
    return res.status(500).json({ error: 'parse_failed', message: e.message });
  }

  // Resolve org_id from user metadata (best-effort)
  const orgId =
    user.app_metadata?.org_id ||
    user.user_metadata?.org_id ||
    null;

  try {
    const { data: batchRow, error: batchErr } = await supabaseAdmin
      .from('asset_import_batches')
      .insert({
        batch_name: batchName,
        batch_date: new Date().toISOString().slice(0, 10),
        file_name: uploadedFile.originalFilename,
        file_size_bytes: uploadedFile.size || buffer.length,
        file_hash: fileHash,
        status: 'pending',
        total_rows: result.total_rows,
        processed_count: 0,
        success_count: 0,
        error_count: result.error_rows,
        import_result: {
          valid_rows: result.valid_rows,
          error_rows: result.error_rows,
          warning_rows: result.warning_rows,
          global_errors: result.global_errors,
          global_warnings: result.global_warnings,
          can_proceed: result.can_proceed,
        },
        org_id: orgId,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id, batch_name, file_name, status, total_rows, created_at')
      .single();

    if (batchErr) return res.status(500).json({ error: 'batch_insert_failed', message: batchErr.message });

    // Insert items (chunked)
    const items = result.rows.map((r) => ({
      batch_id: batchRow.id,
      row_number: r.row_number,
      status: r.errors.length > 0 ? 'error' : 'pending',
      raw_data: r.data,
      validation_errors: r.errors.length > 0 ? r.errors : null,
      validation_warnings: r.warnings.length > 0 ? r.warnings : null,
    }));

    const CHUNK = 200;
    for (let i = 0; i < items.length; i += CHUNK) {
      const slice = items.slice(i, i + CHUNK);
      const { error: itemErr } = await supabaseAdmin.from('asset_import_items').insert(slice);
      if (itemErr) {
        // Rollback batch on partial failure
        await supabaseAdmin.from('asset_import_batches').delete().eq('id', batchRow.id);
        return res.status(500).json({ error: 'item_insert_failed', message: itemErr.message });
      }
    }

    return res.status(201).json({
      batch_id: batchRow.id,
      batch_name: batchRow.batch_name,
      file_name: batchRow.file_name,
      status: batchRow.status,
      total_rows: batchRow.total_rows,
      valid_rows: result.valid_rows,
      error_rows: result.error_rows,
      can_proceed: result.can_proceed,
      created_at: batchRow.created_at,
    });
  } catch (e) {
    return res.status(500).json({ error: 'create_failed', message: e.message });
  }
}

// ── Inline parse + validate (subset of /validate logic) ───────────────
function parseAndValidate(XLSX, buffer, fileName) {
  const REQUIRED_HEADERS = ['asset_class_code', 'machine_asset_code', 'machine_asset_number', 'name_en', 'status'];
  const OPTIONAL_HEADERS = ['serial_no', 'name_ta', 'model', 'make', 'year_of_manufacture', 'location', 'remark'];
  const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const VALID_STATUS = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];
  const MAC_PATTERN = /^\d{2}\.\d{3}[A-Z]?\.\d{3}[A-Z]?$/;
  const CLASS_PATTERN = /^\d{2}\.\d{3}[A-Z]?$/;
  const MAN_PATTERN = /^DCMI-[A-Z0-9]+-[A-Z0-9]+-[0-9]{2,3}[A-Z]?$/;

  const str = (v) => {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => /asset.?master/i.test(n)) ||
    wb.SheetNames.find((n) => /assets/i.test(n)) ||
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

  const global_errors = [];
  const global_warnings = [];

  if (rawRows.length === 0) {
    return {
      total_rows: 0, valid_rows: 0, error_rows: 0, warning_rows: 0,
      rows: [], global_errors: ['데이터 행 없음'], global_warnings, can_proceed: false,
    };
  }
  if (rawRows.length > 600) global_errors.push(`행 수 초과: ${rawRows.length}행 (최대 600행)`);

  const headers = Object.keys(rawRows[0]);
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) global_errors.push(`필수 열 누락: "${h}"`);
  }

  const rows = rawRows.map((raw, idx) => {
    const rowNum = idx + 2;
    const errors = [];
    const warnings = [];
    const data = Object.fromEntries(ALL_HEADERS.map((h) => [h, null]));

    const acc = str(raw.asset_class_code);
    if (!acc) errors.push(`Row ${rowNum}: asset_class_code 필수`);
    else if (!CLASS_PATTERN.test(acc)) errors.push(`Row ${rowNum}: asset_class_code 형식 오류 "${acc}"`);
    else data.asset_class_code = acc;

    const mac = str(raw.machine_asset_code);
    if (!mac) errors.push(`Row ${rowNum}: machine_asset_code 필수`);
    else if (!MAC_PATTERN.test(mac)) errors.push(`Row ${rowNum}: machine_asset_code 형식 오류 "${mac}"`);
    else data.machine_asset_code = mac;

    const man = str(raw.machine_asset_number);
    if (!man) errors.push(`Row ${rowNum}: machine_asset_number 필수`);
    else {
      if (!MAN_PATTERN.test(man)) warnings.push(`Row ${rowNum}: 비표준 machine_asset_number "${man}"`);
      data.machine_asset_number = man;
    }

    const nameEn = str(raw.name_en);
    if (!nameEn) errors.push(`Row ${rowNum}: name_en 필수`);
    else if (nameEn.length < 3) errors.push(`Row ${rowNum}: name_en 최소 3자`);
    else if (nameEn.length > 200) errors.push(`Row ${rowNum}: name_en 최대 200자`);
    else data.name_en = nameEn;

    const statusRaw = str(raw.status);
    if (!statusRaw) errors.push(`Row ${rowNum}: status 필수`);
    else {
      const sl = statusRaw.toLowerCase();
      if (!VALID_STATUS.includes(sl)) errors.push(`Row ${rowNum}: 잘못된 status "${statusRaw}"`);
      else data.status = sl;
    }

    data.serial_no = str(raw.serial_no);
    const nameTa = str(raw.name_ta);
    data.name_ta = nameTa && nameTa.length > 200 ? nameTa.slice(0, 200) : nameTa;
    const model = str(raw.model);
    data.model = model && model.length > 100 ? model.slice(0, 100) : model;
    const make = str(raw.make);
    data.make = make && make.length > 100 ? make.slice(0, 100) : make;
    const yr = raw.year_of_manufacture;
    if (yr != null && yr !== '') {
      const y = parseInt(String(yr), 10);
      if (!isNaN(y) && y >= 1980 && y <= 2030) data.year_of_manufacture = y;
      else warnings.push(`Row ${rowNum}: year_of_manufacture 범위 초과 — 무시`);
    }
    const loc = str(raw.location);
    data.location = loc && loc.length > 150 ? loc.slice(0, 150) : loc;
    const remark = str(raw.remark);
    data.remark = remark && remark.length > 500 ? remark.slice(0, 500) : remark;

    return { row_number: rowNum, data, errors, warnings };
  });

  const valid_rows = rows.filter((r) => r.errors.length === 0).length;
  const error_rows = rows.length - valid_rows;
  const warning_rows = rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;

  return {
    total_rows: rawRows.length,
    valid_rows, error_rows, warning_rows,
    rows, global_errors, global_warnings,
    can_proceed: global_errors.length === 0 && error_rows === 0,
  };
}
