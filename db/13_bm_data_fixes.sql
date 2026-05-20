-- 13_bm_data_fixes.sql
-- BM 데이터 정합성 보정 + bm_kpi 뷰 재생성
-- 실행 전제: 12_bm_technicians_causecodes.sql 완료 후 실행
-- 실행 위치: Supabase SQL Editor (service_role)
-- 작성: 2026-05-19

-- ═══════════════════════════════════════════════════════
-- 진단: 실행 전 현황 출력
-- ═══════════════════════════════════════════════════════
DO $$
DECLARE
  v_total     integer;
  v_res_null  integer;
  v_dt_bad    integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM bm_events;
  SELECT COUNT(*) INTO v_res_null
    FROM bm_events WHERE status = 'resolved' AND resolved_at IS NULL;
  SELECT COUNT(*) INTO v_dt_bad
    FROM bm_events
    WHERE downtime_start IS NOT NULL AND downtime_end IS NOT NULL
      AND downtime_end > downtime_start
      AND downtime_minutes IS DISTINCT FROM
          EXTRACT(EPOCH FROM (downtime_end - downtime_start))::integer / 60;

  RAISE NOTICE '=== 13_bm_data_fixes 실행 전 진단 ===';
  RAISE NOTICE '전체 bm_events: %건', v_total;
  RAISE NOTICE 'resolved_at 누락 (resolved 건): %건 → 소급 입력 예정', v_res_null;
  RAISE NOTICE 'downtime_minutes 불일치: %건 → 재계산 예정', v_dt_bad;
END$$;

-- ═══════════════════════════════════════════════════════
-- 1. resolved_at 소급 입력
--    정책: resolved 건 중 resolved_at IS NULL → downtime_end 값으로 채움
--    근거: downtime_end = 설비 재가동 시각 = 실질적 수리 완료 시각
-- ═══════════════════════════════════════════════════════
UPDATE bm_events
SET resolved_at = downtime_end
WHERE status = 'resolved'
  AND resolved_at IS NULL
  AND downtime_end IS NOT NULL;

DO $$
DECLARE v_cnt integer;
BEGIN
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RAISE NOTICE '[1] resolved_at 소급 입력 완료: %건', v_cnt;
END$$;

-- ═══════════════════════════════════════════════════════
-- 2. downtime_minutes 재계산
--    (downtime_end - downtime_start) 기준 — 수동 입력값 불일치 126건 포함
--    조건: downtime_end > downtime_start (정상 범위)
-- ═══════════════════════════════════════════════════════
UPDATE bm_events
SET downtime_minutes = EXTRACT(EPOCH FROM (downtime_end - downtime_start))::integer / 60
WHERE downtime_start IS NOT NULL
  AND downtime_end IS NOT NULL
  AND downtime_end > downtime_start;

DO $$
DECLARE v_cnt integer;
BEGIN
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RAISE NOTICE '[2] downtime_minutes 재계산 완료: %건', v_cnt;
END$$;

-- ═══════════════════════════════════════════════════════
-- 3. 이상값 처리 (downtime_end <= downtime_start)
--    현장 입력 오류 — work_hours * 60 으로 대체
--    work_hours도 없는 경우 NULL 유지
-- ═══════════════════════════════════════════════════════
UPDATE bm_events
SET downtime_minutes = ROUND(work_hours * 60)::integer
WHERE downtime_start IS NOT NULL
  AND downtime_end IS NOT NULL
  AND downtime_end <= downtime_start
  AND work_hours IS NOT NULL
  AND work_hours > 0;

DO $$
DECLARE v_cnt integer;
BEGIN
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RAISE NOTICE '[3] 이상값(음수 다운타임) work_hours 대체: %건', v_cnt;
END$$;

-- ═══════════════════════════════════════════════════════
-- 4. bm_kpi 뷰 재생성
--    resolved_at 기반 MTTR + MTBF 계산 포함
--    기존 뷰와의 호환: asset_id, month, breakdown_count, mttr_min 유지
-- ═══════════════════════════════════════════════════════
DROP VIEW IF EXISTS bm_kpi;

CREATE OR REPLACE VIEW bm_kpi AS
SELECT
  e.asset_id,
  a.machine_asset_number,
  a.name_en,
  DATE_TRUNC('month', e.reported_at)                        AS month,
  COUNT(*)                                                   AS breakdown_count,
  -- MTTR: downtime_minutes 평균 (재계산된 값 기준)
  ROUND(AVG(e.downtime_minutes)::numeric, 1)                AS mttr_min,
  -- MTBF: 월 내 첫~마지막 고장 사이 시간 / (고장건수-1)
  --        고장 1건이면 월초~해당 고장까지의 시간으로 근사
  ROUND(
    CASE
      WHEN COUNT(*) > 1
      THEN EXTRACT(EPOCH FROM (MAX(e.reported_at) - MIN(e.reported_at))) / 60.0
           / NULLIF(COUNT(*) - 1, 0)
      ELSE EXTRACT(EPOCH FROM (
             DATE_TRUNC('month', e.reported_at) + INTERVAL '1 month' - MIN(e.reported_at)
           )) / 60.0
    END
  ::numeric, 1)                                             AS mtbf_min,
  SUM(e.downtime_minutes)                                    AS total_downtime_min,
  ROUND(AVG(e.work_hours)::numeric, 2)                      AS avg_work_hours
FROM bm_events e
JOIN assets a ON a.id = e.asset_id
WHERE e.status = 'resolved'
  AND e.downtime_minutes IS NOT NULL
GROUP BY
  e.asset_id,
  a.machine_asset_number,
  a.name_en,
  DATE_TRUNC('month', e.reported_at);

-- bm_kpi 뷰 RLS (뷰는 기반 테이블 정책 상속, 명시적 정책 불필요)
-- anon도 조회 가능하도록 bm_events anon 정책 확인
DO $$
DECLARE v_cnt bigint;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM bm_kpi;
  RAISE NOTICE '[4] bm_kpi 뷰 재생성 완료 — 집계 행 수: %', v_cnt;
END$$;

-- ═══════════════════════════════════════════════════════
-- 5. 사후 검증
-- ═══════════════════════════════════════════════════════
DO $$
DECLARE
  v_res_null  integer;
  v_dt_bad    integer;
  v_negative  integer;
BEGIN
  SELECT COUNT(*) INTO v_res_null
    FROM bm_events WHERE status = 'resolved' AND resolved_at IS NULL;
  SELECT COUNT(*) INTO v_dt_bad
    FROM bm_events
    WHERE downtime_start IS NOT NULL AND downtime_end IS NOT NULL
      AND downtime_end > downtime_start
      AND downtime_minutes IS DISTINCT FROM
          EXTRACT(EPOCH FROM (downtime_end - downtime_start))::integer / 60;
  SELECT COUNT(*) INTO v_negative
    FROM bm_events
    WHERE downtime_minutes IS NOT NULL AND downtime_minutes < 0;

  RAISE NOTICE '=== 13_bm_data_fixes 실행 후 검증 ===';
  RAISE NOTICE 'resolved_at 누락 잔존: %건 (목표: 0)', v_res_null;
  RAISE NOTICE 'downtime_minutes 불일치 잔존: %건 (목표: 0)', v_dt_bad;
  RAISE NOTICE 'downtime_minutes 음수: %건 (목표: 0)', v_negative;

  IF v_res_null > 0 THEN
    RAISE WARNING 'resolved_at 누락 %건 — downtime_end가 NULL인 건 확인 필요', v_res_null;
  END IF;
  IF v_dt_bad > 0 THEN
    RAISE WARNING 'downtime_minutes 불일치 %건 잔존', v_dt_bad;
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════
-- 완료 메시지
-- ═══════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '13_bm_data_fixes.sql 완료';
  RAISE NOTICE '다음 단계: Web-builder Phase 1 구현 시작';
END$$;
