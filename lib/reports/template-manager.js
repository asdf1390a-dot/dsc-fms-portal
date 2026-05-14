// 월별 보고서 템플릿 관리 모듈
// 기본: 4월 2026 템플릿 (경영실적_4월_기본템플릿.xlsx)
// 각 신규 월은 4월 템플릿을 복사하고 그 달의 데이터만 업데이트
// 역사 데이터 (1월-3월)는 절대 수정하지 않음
// 차트 롤링 윈도우는 자동으로 최근 3개월만 표시하도록 이동

import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../supabase-admin';

// 템플릿 파일 경로
const TEMPLATE_ROOT = process.env.TEMPLATE_ROOT || path.join(process.cwd(), 'public', 'templates');
const APRIL_TEMPLATE_FILE = '경영실적_4월_기본템플릿.xlsx';
const APRIL_TEMPLATE_PATH = path.join(TEMPLATE_ROOT, APRIL_TEMPLATE_FILE);

// Supabase 스토리지
const BUCKET = 'templates';

// ──────────────────────────────────────────────────────────────────────
// 로컬 템플릿 관리
// ──────────────────────────────────────────────────────────────────────

/**
 * 로컬 파일시스템 또는 Supabase에서 4월 기본 템플릿 가져오기.
 * @returns {Promise<Buffer>}
 */
export async function getAprilTemplate() {
  // 먼저 로컬 파일 시도 (개발/오프라인용)
  if (fs.existsSync(APRIL_TEMPLATE_PATH)) {
    return fs.readFileSync(APRIL_TEMPLATE_PATH);
  }

  // Supabase 스토리지로 폴백
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(APRIL_TEMPLATE_FILE);

  if (error) {
    throw new Error(`4월 템플릿 로드 실패: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * 템플릿 유효성 검증 (필요한 시트와 구조 확인)
 * @param {Buffer} buf
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function verifyTemplate(buf) {
  try {
    // 기본 검증 — 실제 구현은 XLSX를 파싱하고
    // 시트 구조, 컬럼 위치 등을 검증해야 함
    if (!buf || buf.length === 0) {
      return { valid: false, error: '빈 버퍼' };
    }
    // XLSX 매직 바이트 확인 (PK 시그니처)
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return { valid: false, error: '유효한 XLSX 파일이 아님' };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: String(e.message || e) };
  }
}

/**
 * 생성된 월별 보고서를 새 템플릿으로 저장 (관리자 승인 후에만)
 * 버전 관리 및 백업을 위해 Supabase에 저장.
 * @param {number} year
 * @param {number} month
 * @param {Buffer} reportBuf
 * @param {string} description
 */
export async function saveMonthlyTemplateSnapshot(year, month, reportBuf, description = '') {
  const monthTag = `${year}-${String(month).padStart(2, '0')}`;
  const filename = `snapshot_${monthTag}_경영실적.xlsx`;
  const path = `snapshots/${filename}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, reportBuf, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (error) {
    throw new Error(`템플릿 스냅샷 저장 실패: ${error.message}`);
  }

  return { path, filename, saved_at: new Date().toISOString(), description };
}

// ──────────────────────────────────────────────────────────────────────
// 메타데이터 및 추적
// ──────────────────────────────────────────────────────────────────────

/**
 * 템플릿 사용 및 월별 보고서 생성 기록.
 * 어느 월이 완료되었는지, 언제 완료했는지 추적하는데 도움.
 * @param {number} year
 * @param {number} month
 * @param {string} status  'created'|'generated'|'approved'|'archived'
 * @param {object} metadata 추가 정보
 */
export async function logTemplateUsage(year, month, status, metadata = {}) {
  const monthTag = `${year}-${String(month).padStart(2, '0')}`;

  const { error } = await supabaseAdmin
    .from('template_usage_log')
    .insert({
      month_tag: monthTag,
      status,
      metadata: JSON.stringify(metadata),
      logged_at: new Date().toISOString(),
    });

  if (error && !error.message.includes('relation "template_usage_log" does not exist')) {
    console.warn(`템플릿 사용 기록 실패: ${error.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// 공개 워크플로우 문서화
// ──────────────────────────────────────────────────────────────────────

/**
 * 월별 보고서 생성 워크플로우:
 *
 * 1. 4월 2026 기본 템플릿 (경영실적_4월_기본템플릿.xlsx)
 *    - 12개월 데이터 포함: 1월-12월 (월지표 시트의 U-AF 컬럼)
 *    - 3월 이전 데이터 (1월-3월)는 최종 확정되어 절대 수정 불가
 *    - 4월 데이터는 시작점
 *
 * 2. 5월 2026:
 *    a) 4월 템플릿 로드
 *    b) 새 5월 작업 파일로 복사
 *    c) 5월 컬럼 (월지표 시트의 W)을 5월 raw 데이터로 업데이트
 *    d) 모든 역사 데이터 유지 (1월-2월의 U, V; W 이전 컬럼들)
 *    e) 차트 롤링 윈도우 업데이트: 1월-3월 대신 2월-4월 표시
 *    f) 5월 완성 보고서 저장
 *
 * 3. 6월 2026:
 *    a) 5월 완성 보고서 로드 (4월 템플릿이 아님!)
 *    b) 새 6월 작업 파일로 복사
 *    c) 6월 컬럼 (월지표 시트의 X)을 6월 raw 데이터로 업데이트
 *    d) 모든 역사 데이터 유지
 *    e) 차트 롤링 윈도우 업데이트: 3월-5월 표시
 *    f) 6월 완성 보고서 저장
 *
 * 4. 체인이 계속됨: 각 월이 이전 월을 기반으로 함
 *    - 템플릿은 체인을 형성: 4월 → 5월 → 6월 → 7월 → ...
 *    - 차트 롤링 윈도우는 매월 이동
 *    - 역사 데이터는 누적으로 증가
 *    - 3월 이전 데이터는 절대 변경되지 않음
 *
 * 이 접근법을 사용하는 이유?
 * - 이전 월들의 모든 수정 및 업데이트 보존
 * - 템플릿 유지보수 감소 (월별 별도 템플릿 관리 불필요)
 * - 롤링 윈도우는 차트를 최근 추세에만 집중하도록 유지
 * - 데이터 무결성: 월이 확정되면 향후 보고서에서 잠금
 */
