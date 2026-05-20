/**
 * Asset Import Validator — Phase 2 강화판
 *
 * 3단계 검증:
 *   1. 형식(Type) 검증 — 각 행 단독 체크
 *   2. 범위(Range) 검증 — 값 한계, asset_class_code DB 조회
 *   3. 중복(Duplicate) 검증 — 파일 내 + DB 충돌
 *
 * 기준일: 2026-05-19
 */

import * as XLSX from 'xlsx';

// ── 상수 ──────────────────────────────────────────────────────────────────

export const REQUIRED_HEADERS = [
  'asset_class_code',
  'machine_asset_code',
  'machine_asset_number',
  'name_en',
  'status',
] as const;

export const OPTIONAL_HEADERS = [
  'serial_no',
  'name_ta',
  'model',
  'make',
  'year_of_manufacture',
  'location',
  'remark',
] as const;

export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const VALID_STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'] as const;

// machine_asset_number 허용 패턴:
//   DCMI-XXX-XXX-NN  (기본)
//   DCMI-XXXXXXXX-NNN (JIG/MOULD 형)
//   DCMI-XX-NN        (짧은 형)
const MAN_PATTERN = /^DCMI-[A-Z0-9]+-[A-Z0-9]+-[0-9]{2,3}([A-Z])?$/;
const MAC_PATTERN = /^\d{2}\.\d{3}[A-Z]?\.\d{3}[A-Z]?$/;
const CLASS_PATTERN = /^\d{2}\.\d{3}[A-Z]?$/;

const YEAR_MIN = 1980;
const YEAR_MAX = 2030;
const BATCH_SIZE = 100; // Supabase REST 배치 단위

// ── 타입 ──────────────────────────────────────────────────────────────────

export interface RowData {
  asset_class_code: string | null;
  machine_asset_code: string | null;
  machine_asset_number: string | null;
  serial_no: string | null;
  name_en: string | null;
  name_ta: string | null;
  model: string | null;
  make: string | null;
  year_of_manufacture: number | null;
  location: string | null;
  status: string | null;
  remark: string | null;
}

export interface ValidatedRow {
  row_number: number;
  data: RowData;
  errors: string[];    // 치명적 — import 차단
  warnings: string[];  // 경고 — import는 허용
}

export interface DBConflict {
  machine_asset_code: string;
  machine_asset_number: string;
  existing_id: string;
}

export interface ValidationResult {
  file_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  warning_rows: number;
  rows: ValidatedRow[];
  global_errors: string[];
  global_warnings: string[];
  db_conflicts: DBConflict[];      // 이미 존재하는 asset
  can_proceed: boolean;            // global_errors + error_rows === 0
  missing_class_codes: string[];   // DB에 없는 asset_class_code
}

// ── Step 1: 파일 파싱 ─────────────────────────────────────────────────────

export function parseFile(
  buffer: Buffer | ArrayBuffer,
  fileName: string
): Record<string, any>[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // 시트 탐색: "Asset Master" > "Assets" > 첫번째 시트
  const targetSheet =
    wb.SheetNames.find((n) => /asset.?master/i.test(n)) ||
    wb.SheetNames.find((n) => /assets/i.test(n)) ||
    wb.SheetNames[0];

  if (!targetSheet) throw new Error('No sheets found in workbook');

  const ws = wb.Sheets[targetSheet];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: false,
  });

  return rawRows;
}

// ── Step 2: 행 단위 형식/범위 검증 ────────────────────────────────────────

export function validateRow(raw: Record<string, any>, rowNum: number): ValidatedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: RowData = {
    asset_class_code: null,
    machine_asset_code: null,
    machine_asset_number: null,
    serial_no: null,
    name_en: null,
    name_ta: null,
    model: null,
    make: null,
    year_of_manufacture: null,
    location: null,
    status: null,
    remark: null,
  };

  // Helper: string trim & null
  const str = (v: any): string | null => {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  // ── asset_class_code ──
  const acc = str(raw.asset_class_code);
  if (!acc) {
    errors.push(`Row ${rowNum}: asset_class_code 필수`);
  } else if (!CLASS_PATTERN.test(acc)) {
    errors.push(`Row ${rowNum}: asset_class_code 형식 오류 "${acc}" (예: 01.001 또는 01.001A)`);
  } else {
    data.asset_class_code = acc;
  }

  // ── machine_asset_code ──
  const mac = str(raw.machine_asset_code);
  if (!mac) {
    errors.push(`Row ${rowNum}: machine_asset_code 필수`);
  } else if (!MAC_PATTERN.test(mac)) {
    errors.push(`Row ${rowNum}: machine_asset_code 형식 오류 "${mac}" (예: 01.001.001 또는 09.001.004)`);
  } else {
    data.machine_asset_code = mac;
  }

  // ── machine_asset_number ──
  const man = str(raw.machine_asset_number);
  if (!man) {
    errors.push(`Row ${rowNum}: machine_asset_number 필수`);
  } else if (!MAN_PATTERN.test(man)) {
    // 경고로만 처리 — 비표준 형식도 일부 존재 (JIG/MOULD)
    warnings.push(`Row ${rowNum}: machine_asset_number 비표준 형식 "${man}" (DCMI-XXX-XXX-NN 권장)`);
    data.machine_asset_number = man;
  } else {
    data.machine_asset_number = man;
  }

  // ── name_en ──
  const nameEn = str(raw.name_en);
  if (!nameEn) {
    errors.push(`Row ${rowNum}: name_en 필수`);
  } else {
    const len = nameEn.length;
    if (len < 3) errors.push(`Row ${rowNum}: name_en 최소 3자 (현재 ${len}자)`);
    else if (len > 200) errors.push(`Row ${rowNum}: name_en 최대 200자 (현재 ${len}자)`);
    else data.name_en = nameEn;
  }

  // ── status ──
  const statusRaw = str(raw.status);
  if (!statusRaw) {
    errors.push(`Row ${rowNum}: status 필수`);
  } else {
    const statusLower = statusRaw.toLowerCase();
    if (!(VALID_STATUSES as readonly string[]).includes(statusLower)) {
      errors.push(`Row ${rowNum}: 잘못된 status "${statusRaw}" (허용: ${VALID_STATUSES.join(', ')})`);
    } else {
      data.status = statusLower;
    }
  }

  // ── 선택 필드 ──

  data.serial_no = str(raw.serial_no);

  const nameTa = str(raw.name_ta);
  if (nameTa && nameTa.length > 200) {
    warnings.push(`Row ${rowNum}: name_ta 최대 200자 (현재 ${nameTa.length}자) — 자동 절단`);
    data.name_ta = nameTa.slice(0, 200);
  } else {
    data.name_ta = nameTa;
  }

  data.model = str(raw.model);
  if (data.model && data.model.length > 100) {
    warnings.push(`Row ${rowNum}: model 최대 100자 — 자동 절단`);
    data.model = data.model.slice(0, 100);
  }

  data.make = str(raw.make);
  if (data.make && data.make.length > 100) {
    warnings.push(`Row ${rowNum}: make 최대 100자 — 자동 절단`);
    data.make = data.make.slice(0, 100);
  }

  // year_of_manufacture
  const yearRaw = raw.year_of_manufacture;
  if (yearRaw != null && yearRaw !== '') {
    const y = parseInt(String(yearRaw), 10);
    if (isNaN(y)) {
      warnings.push(`Row ${rowNum}: year_of_manufacture 숫자 아님 "${yearRaw}" — 무시`);
    } else if (y < YEAR_MIN || y > YEAR_MAX) {
      warnings.push(`Row ${rowNum}: year_of_manufacture 범위 초과 ${y} (${YEAR_MIN}~${YEAR_MAX}) — 무시`);
    } else {
      data.year_of_manufacture = y;
    }
  }

  const loc = str(raw.location);
  if (loc && loc.length > 150) {
    warnings.push(`Row ${rowNum}: location 최대 150자 — 자동 절단`);
    data.location = loc.slice(0, 150);
  } else {
    data.location = loc;
  }

  const remark = str(raw.remark);
  if (remark && remark.length > 500) {
    warnings.push(`Row ${rowNum}: remark 최대 500자 — 자동 절단`);
    data.remark = remark.slice(0, 500);
  } else {
    data.remark = remark;
  }

  return { row_number: rowNum, data, errors, warnings };
}

// ── Step 3: 전역 중복 검증 (파일 내) ─────────────────────────────────────

export function validateGlobalDuplicates(rows: ValidatedRow[]): string[] {
  const errors: string[] = [];

  const macSet = new Map<string, number[]>(); // machine_asset_code → [row_numbers]
  const manSet = new Map<string, number[]>(); // machine_asset_number → [row_numbers]

  for (const r of rows) {
    const mac = r.data.machine_asset_code?.toLowerCase();
    const man = r.data.machine_asset_number?.toUpperCase();

    if (mac) {
      if (!macSet.has(mac)) macSet.set(mac, []);
      macSet.get(mac)!.push(r.row_number);
    }
    if (man) {
      if (!manSet.has(man)) manSet.set(man, []);
      manSet.get(man)!.push(r.row_number);
    }
  }

  for (const [code, lines] of macSet) {
    if (lines.length > 1) {
      errors.push(`파일 내 중복 machine_asset_code "${code}" — Rows: ${lines.join(', ')}`);
    }
  }
  for (const [num, lines] of manSet) {
    if (lines.length > 1) {
      errors.push(`파일 내 중복 machine_asset_number "${num}" — Rows: ${lines.join(', ')}`);
    }
  }

  return errors;
}

// ── Step 4: DB 충돌 검증 (서버사이드) ────────────────────────────────────

/**
 * DB에 이미 존재하는 machine_asset_code 또는 machine_asset_number 탐지.
 * supabaseAdmin 클라이언트를 파라미터로 받아 서버 전용으로 동작.
 */
export async function checkDBConflicts(
  rows: ValidatedRow[],
  supabaseAdmin: any
): Promise<{ conflicts: DBConflict[]; missingClassCodes: string[] }> {
  const validRows = rows.filter((r) => r.errors.length === 0);
  const conflicts: DBConflict[] = [];

  // ── machine_asset_code 중복 체크 (배치) ──
  const allCodes = validRows
    .map((r) => r.data.machine_asset_code)
    .filter(Boolean) as string[];

  for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
    const batch = allCodes.slice(i, i + BATCH_SIZE);
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

  // ── asset_class_code 존재 여부 체크 ──
  const classCodesInFile = [
    ...new Set(validRows.map((r) => r.data.asset_class_code).filter(Boolean) as string[]),
  ];

  const missingClassCodes: string[] = [];
  for (let i = 0; i < classCodesInFile.length; i += BATCH_SIZE) {
    const batch = classCodesInFile.slice(i, i + BATCH_SIZE);
    const { data } = await supabaseAdmin
      .from('asset_classes')
      .select('code')
      .in('code', batch);

    const foundCodes = new Set((data || []).map((r: any) => r.code));
    for (const c of batch) {
      if (!foundCodes.has(c)) missingClassCodes.push(c);
    }
  }

  return { conflicts, missingClassCodes };
}

// ── 통합 엔트리포인트 (클라이언트 측 — DB 검증 제외) ─────────────────────

export function validateImportFile(
  buffer: Buffer | ArrayBuffer,
  fileName: string
): Omit<ValidationResult, 'db_conflicts' | 'missing_class_codes'> & {
  db_conflicts: [];
  missing_class_codes: [];
} {
  const rawRows = parseFile(buffer, fileName);

  const global_errors: string[] = [];
  const global_warnings: string[] = [];

  if (rawRows.length === 0) {
    global_errors.push('파일에 데이터 행이 없습니다');
    return {
      file_name: fileName,
      total_rows: 0,
      valid_rows: 0,
      error_rows: 0,
      warning_rows: 0,
      rows: [],
      global_errors,
      global_warnings,
      db_conflicts: [],
      missing_class_codes: [],
      can_proceed: false,
    };
  }

  if (rawRows.length > 600) {
    global_errors.push(`행 수 초과: ${rawRows.length}행 (최대 600행)`);
  }

  // 헤더 존재 여부 확인
  const headers = Object.keys(rawRows[0]);
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      global_errors.push(`필수 열 누락: "${h}"`);
    }
  }

  // 각 행 검증
  const rows = rawRows.map((raw, idx) => validateRow(raw, idx + 2));

  // 전역 중복 검증
  const dupErrors = validateGlobalDuplicates(rows);
  global_errors.push(...dupErrors);

  const valid_rows = rows.filter((r) => r.errors.length === 0).length;
  const error_rows = rows.filter((r) => r.errors.length > 0).length;
  const warning_rows = rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;

  return {
    file_name: fileName,
    total_rows: rawRows.length,
    valid_rows,
    error_rows,
    warning_rows,
    rows,
    global_errors,
    global_warnings,
    db_conflicts: [],
    missing_class_codes: [],
    can_proceed: global_errors.length === 0 && error_rows === 0,
  };
}
