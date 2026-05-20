/**
 * POST /api/assets/import/validate
 *
 * 3단계 검증: 형식 + 범위 + DB 충돌
 *
 * Request: multipart/form-data
 *   file: Excel/CSV 파일 (max 5MB)
 *
 * Response 200:
 *   ValidationResult (see import-validator.ts)
 *
 * Auth: Bearer JWT (user)
 */

import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export const config = {
  api: { bodyParser: false }, // formidable handles multipart
};

// Dynamic import for TS module
async function getValidator() {
  // Use compiled JS if available, else tsx transform
  try {
    return require('../../../../lib/assets/import-validator');
  } catch {
    // Fallback: transpile at runtime (dev only)
    require('@babel/register')({ extensions: ['.ts'] });
    return require('../../../../lib/assets/import-validator');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  // Parse multipart form
  const form = new IncomingForm({
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    keepExtensions: true,
  });

  let files;
  try {
    [, files] = await form.parse(req);
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

  let buffer;
  try {
    buffer = fs.readFileSync(uploadedFile.filepath);
  } catch (e) {
    return res.status(500).json({ error: 'file_read_failed', message: e.message });
  }

  // Step 1+2: 형식 + 범위 검증 (동기)
  let result;
  try {
    const XLSX = require('xlsx');
    const validator = buildValidator(XLSX);
    result = validator.validateImportFile(buffer, uploadedFile.originalFilename || 'upload');
  } catch (e) {
    return res.status(500).json({ error: 'validation_error', message: e.message });
  }

  // Step 3: DB 충돌 검증 (비동기 — valid rows만 체크)
  try {
    const validRows = result.rows.filter((r) => r.errors.length === 0);

    // machine_asset_code 중복 체크
    const allCodes = validRows
      .map((r) => r.data.machine_asset_code)
      .filter(Boolean);

    const conflicts = [];
    const BATCH = 100;

    for (let i = 0; i < allCodes.length; i += BATCH) {
      const batch = allCodes.slice(i, i + BATCH);
      const { data } = await supabaseAdmin
        .from('assets')
        .select('id, machine_asset_code, machine_asset_number')
        .in('machine_asset_code', batch);

      if (data) {
        for (const existing of data) {
          conflicts.push({
            machine_asset_code: existing.machine_asset_code,
            machine_asset_number: existing.machine_asset_number,
            existing_id: existing.id,
          });
        }
      }
    }

    // asset_class_code 존재 여부 체크
    const classCodesInFile = [
      ...new Set(validRows.map((r) => r.data.asset_class_code).filter(Boolean)),
    ];

    const missingClassCodes = [];
    for (let i = 0; i < classCodesInFile.length; i += BATCH) {
      const batch = classCodesInFile.slice(i, i + BATCH);
      const { data } = await supabaseAdmin
        .from('asset_classes')
        .select('code')
        .in('code', batch);

      const foundCodes = new Set((data || []).map((r) => r.code));
      for (const c of batch) {
        if (!foundCodes.has(c)) missingClassCodes.push(c);
      }
    }

    // missing class codes → global errors (치명적)
    for (const c of missingClassCodes) {
      result.global_errors.push(`asset_class_code "${c}" DB에 존재하지 않음`);
    }

    result.db_conflicts = conflicts;
    result.missing_class_codes = missingClassCodes;
    result.can_proceed =
      result.global_errors.length === 0 && result.error_rows === 0;

  } catch (e) {
    // DB 검증 실패는 경고로만 처리 (네트워크 이슈 등)
    result.global_warnings = result.global_warnings || [];
    result.global_warnings.push(`DB 충돌 검증 실패: ${e.message} — 수동 확인 필요`);
  }

  // 감사 로그 (검증 시도 기록)
  try {
    await supabaseAdmin.from('asset_audit').insert({
      asset_id: null,
      changed_by: user.id,
      action: 'import_validate',
      diff: {
        file_name: uploadedFile.originalFilename,
        total_rows: result.total_rows,
        valid_rows: result.valid_rows,
        error_rows: result.error_rows,
        can_proceed: result.can_proceed,
      },
    });
  } catch (_) {
    // audit 실패는 무시
  }

  return res.status(200).json(result);
}

// ── 인라인 검증 로직 (TS 모듈 없이 동작하는 JS 버전) ─────────────────────

function buildValidator(XLSX) {
  const REQUIRED_HEADERS = [
    'asset_class_code',
    'machine_asset_code',
    'machine_asset_number',
    'name_en',
    'status',
  ];
  const OPTIONAL_HEADERS = [
    'serial_no', 'name_ta', 'model', 'make',
    'year_of_manufacture', 'location', 'remark',
  ];
  const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const VALID_STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];
  const MAN_PATTERN = /^DCMI-[A-Z0-9]+-[A-Z0-9]+-[0-9]{2,3}[A-Z]?$/;
  const MAC_PATTERN = /^\d{2}\.\d{3}[A-Z]?\.\d{3}[A-Z]?$/;
  const CLASS_PATTERN = /^\d{2}\.\d{3}[A-Z]?$/;

  function str(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  function validateRow(raw, rowNum) {
    const errors = [];
    const warnings = [];
    const data = Object.fromEntries(ALL_HEADERS.map(h => [h, null]));

    // asset_class_code
    const acc = str(raw.asset_class_code);
    if (!acc) errors.push(`Row ${rowNum}: asset_class_code 필수`);
    else if (!CLASS_PATTERN.test(acc)) errors.push(`Row ${rowNum}: asset_class_code 형식 오류 "${acc}"`);
    else data.asset_class_code = acc;

    // machine_asset_code
    const mac = str(raw.machine_asset_code);
    if (!mac) errors.push(`Row ${rowNum}: machine_asset_code 필수`);
    else if (!MAC_PATTERN.test(mac)) errors.push(`Row ${rowNum}: machine_asset_code 형식 오류 "${mac}"`);
    else data.machine_asset_code = mac;

    // machine_asset_number
    const man = str(raw.machine_asset_number);
    if (!man) errors.push(`Row ${rowNum}: machine_asset_number 필수`);
    else {
      if (!MAN_PATTERN.test(man)) warnings.push(`Row ${rowNum}: machine_asset_number 비표준 형식 "${man}"`);
      data.machine_asset_number = man;
    }

    // name_en
    const nameEn = str(raw.name_en);
    if (!nameEn) errors.push(`Row ${rowNum}: name_en 필수`);
    else if (nameEn.length < 3) errors.push(`Row ${rowNum}: name_en 최소 3자`);
    else if (nameEn.length > 200) errors.push(`Row ${rowNum}: name_en 최대 200자`);
    else data.name_en = nameEn;

    // status
    const statusRaw = str(raw.status);
    if (!statusRaw) errors.push(`Row ${rowNum}: status 필수`);
    else {
      const sl = statusRaw.toLowerCase();
      if (!VALID_STATUSES.includes(sl)) errors.push(`Row ${rowNum}: 잘못된 status "${statusRaw}"`);
      else data.status = sl;
    }

    // Optional fields
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
  }

  function validateImportFile(buffer, fileName) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName =
      wb.SheetNames.find(n => /asset.?master/i.test(n)) ||
      wb.SheetNames.find(n => /assets/i.test(n)) ||
      wb.SheetNames[0];

    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

    const global_errors = [];
    const global_warnings = [];

    if (rawRows.length === 0) {
      return {
        file_name: fileName, total_rows: 0, valid_rows: 0, error_rows: 0, warning_rows: 0,
        rows: [], global_errors: ['데이터 행 없음'], global_warnings, db_conflicts: [], missing_class_codes: [], can_proceed: false,
      };
    }

    if (rawRows.length > 600) global_errors.push(`행 수 초과: ${rawRows.length}행 (최대 600행)`);

    const headers = Object.keys(rawRows[0]);
    for (const h of REQUIRED_HEADERS) {
      if (!headers.includes(h)) global_errors.push(`필수 열 누락: "${h}"`);
    }

    const rows = rawRows.map((raw, idx) => validateRow(raw, idx + 2));

    // 파일 내 중복 검사
    const macMap = new Map();
    const manMap = new Map();
    for (const r of rows) {
      const mac = r.data.machine_asset_code?.toLowerCase();
      const man = r.data.machine_asset_number?.toUpperCase();
      if (mac) { if (!macMap.has(mac)) macMap.set(mac, []); macMap.get(mac).push(r.row_number); }
      if (man) { if (!manMap.has(man)) manMap.set(man, []); manMap.get(man).push(r.row_number); }
    }
    for (const [code, lines] of macMap) {
      if (lines.length > 1) global_errors.push(`파일 내 중복 machine_asset_code "${code}" — Rows: ${lines.join(', ')}`);
    }
    for (const [num, lines] of manMap) {
      if (lines.length > 1) global_errors.push(`파일 내 중복 machine_asset_number "${num}" — Rows: ${lines.join(', ')}`);
    }

    const valid_rows = rows.filter(r => r.errors.length === 0).length;
    const error_rows = rows.length - valid_rows;
    const warning_rows = rows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length;

    return {
      file_name: fileName, total_rows: rawRows.length,
      valid_rows, error_rows, warning_rows, rows,
      global_errors, global_warnings,
      db_conflicts: [], missing_class_codes: [],
      can_proceed: global_errors.length === 0 && error_rows === 0,
    };
  }

  return { validateImportFile };
}
