// Audit System Phase 2 — DRS Calculator
// Addresses 4 evaluator-mandated concerns:
//   (1) Partial-data DRS  → weight renormalization
//   (2) Bootstrap         → first-day default + neutral history
//   (3) Network retry     → exported policy used by cron caller (see retry.ts)
//   (4) i18n              → locale-aware alert/report text
//
// Indicator set (matches db/35_audit_system.sql `audit_sessions` columns):
//   backup_recovery_rate   weight 0.40
//   storage_health_rate    weight 0.30
//   data_integrity_rate    weight 0.20
//   accessibility_rate     weight 0.10
//
// Convention: an indicator value of `null` means "no data collected"
// (NOT "0%"). Phase 1 treated null as 100 which masked sensor outages.
// Phase 2 renormalizes weights across the indicators that DO have data
// and flags the report as `partial` when any indicator is missing.

export type IndicatorKey =
  | 'backup_recovery_rate'
  | 'storage_health_rate'
  | 'data_integrity_rate'
  | 'accessibility_rate';

export type Locale = 'en' | 'ko' | 'ta';

export interface IndicatorInput {
  backup_recovery_rate: number | null;
  storage_health_rate: number | null;
  data_integrity_rate: number | null;
  accessibility_rate: number | null;
}

export interface DrsResult {
  drs_score: number;                       // 0..100, rounded
  status: 'good' | 'caution' | 'critical' | 'bootstrap';
  completeness: number;                    // 0..1 = sum(used weights)
  is_partial: boolean;                     // any indicator was null
  is_bootstrap: boolean;                   // first ever report
  used_indicators: IndicatorKey[];
  missing_indicators: IndicatorKey[];
  contributions: Partial<Record<IndicatorKey, number>>; // post-renorm
  warnings: string[];                      // i18n-aware messages
}

export const WEIGHTS: Record<IndicatorKey, number> = {
  backup_recovery_rate: 0.40,
  storage_health_rate: 0.30,
  data_integrity_rate: 0.20,
  accessibility_rate: 0.10,
};

// Bootstrap default — used only on the first ever calendar day when there
// is zero history AND zero current-day events. Reflects "untested optimism":
// the system is assumed healthy until we have signals. Status is marked
// `bootstrap` so dashboards can render it distinctly from `good`.
export const BOOTSTRAP_DRS = 100;
export const MIN_COMPLETENESS_FOR_VALID_DRS = 0.5; // need ≥50% weight covered

// ─── i18n ────────────────────────────────────────────────────────────────
interface LocaleMessages {
  partial: (pct: number) => string;
  bootstrap: string;
  insufficient: (pct: number) => string;
  missing: (key: IndicatorKey) => string;
  alertCritical: (date: string, drs: number) => string;
  alertCaution: (date: string, drs: number) => string;
}

const MESSAGES: Record<Locale, LocaleMessages> = {
  en: {
    partial: (pct: number) =>
      `Partial data: only ${pct}% of indicator weight collected. DRS renormalized.`,
    bootstrap: 'Bootstrap report: no prior history, no events. DRS set to baseline.',
    insufficient: (pct: number) =>
      `Insufficient data: only ${pct}% of indicator weight available (min 50%). DRS marked critical.`,
    missing: (key: IndicatorKey) => `Missing indicator: ${key}`,
    alertCritical: (date: string, drs: number) =>
      `[DSC FMS Audit] CRITICAL — ${date} — DRS ${drs}/100. Immediate review required.`,
    alertCaution: (date: string, drs: number) =>
      `[DSC FMS Audit] CAUTION — ${date} — DRS ${drs}/100. Review at next checkpoint.`,
  },
  ko: {
    partial: (pct: number) =>
      `부분 데이터: 지표 가중치 ${pct}%만 수집됨. DRS 정규화됨.`,
    bootstrap: '부트스트랩 리포트: 히스토리/이벤트 없음. DRS 기본값 적용.',
    insufficient: (pct: number) =>
      `데이터 부족: 가중치 ${pct}%만 수집 (최소 50% 필요). DRS critical 처리.`,
    missing: (key: IndicatorKey) => `지표 누락: ${key}`,
    alertCritical: (date: string, drs: number) =>
      `[DSC FMS 감사] CRITICAL — ${date} — DRS ${drs}/100. 즉시 검토 필요.`,
    alertCaution: (date: string, drs: number) =>
      `[DSC FMS 감사] 주의 — ${date} — DRS ${drs}/100. 다음 체크포인트 검토.`,
  },
  ta: {
    partial: (pct: number) =>
      `பகுதி தரவு: ${pct}% எடை மட்டும் சேகரிக்கப்பட்டது. DRS மீள்அளவீடு செய்யப்பட்டது.`,
    bootstrap: 'தொடக்க அறிக்கை: முந்தைய வரலாறு/நிகழ்வுகள் இல்லை. DRS அடிப்படை மதிப்பு.',
    insufficient: (pct: number) =>
      `தரவு போதவில்லை: ${pct}% மட்டும் (குறைந்தது 50%). DRS critical.`,
    missing: (key: IndicatorKey) => `குறிகாட்டி இல்லை: ${key}`,
    alertCritical: (date: string, drs: number) =>
      `[DSC FMS தணிக்கை] CRITICAL — ${date} — DRS ${drs}/100. உடனடி மறுபரிசீலனை.`,
    alertCaution: (date: string, drs: number) =>
      `[DSC FMS தணிக்கை] கவனம் — ${date} — DRS ${drs}/100.`,
  },
};

export function t(locale: Locale): LocaleMessages {
  return MESSAGES[locale] ?? MESSAGES.en;
}

// ─── Status mapping ──────────────────────────────────────────────────────
export function statusFromDrs(
  drs: number
): 'good' | 'caution' | 'critical' {
  if (drs >= 95) return 'good';
  if (drs >= 85) return 'caution';
  return 'critical';
}

// ─── Core: partial-data aware DRS ────────────────────────────────────────
//
// Algorithm:
//   1. Identify indicators with non-null values → `used`.
//   2. completeness = Σ WEIGHTS[k] for k in used.
//   3. If completeness == 0:
//        - if hasHistory == false → bootstrap (DRS = 100, status='bootstrap').
//        - else → critical (DRS = 0).
//   4. If completeness < MIN_COMPLETENESS_FOR_VALID_DRS (0.5):
//        - DRS = renormalized score, but force status='critical'
//          and emit `insufficient` warning. We still surface a number
//          so the dashboard can show the trend, but the flag protects
//          decision-makers from over-trusting a thin signal.
//   5. Else: DRS = Σ (value[k] * WEIGHTS[k]) / completeness  (renormalized).
//
// Rationale for renormalization vs zero-fill: a missing indicator is an
// observability failure, not a 0% indicator value. Penalizing the score
// with zero would conflate the two and trigger false-positive alerts
// during sensor outages. Renormalization preserves the geometric meaning
// of the score (a weighted average over what we observed) and the
// `is_partial` flag carries the observability concern to consumers.

export interface CalcOptions {
  locale?: Locale;
  hasHistory?: boolean; // true if any prior audit_sessions row exists
}

export function calculateDrs(
  input: IndicatorInput,
  opts: CalcOptions = {}
): DrsResult {
  const locale: Locale = opts.locale ?? 'en';
  const hasHistory = opts.hasHistory ?? true;
  const msg = t(locale);

  const keys: IndicatorKey[] = [
    'backup_recovery_rate',
    'storage_health_rate',
    'data_integrity_rate',
    'accessibility_rate',
  ];

  const used: IndicatorKey[] = [];
  const missing: IndicatorKey[] = [];
  for (const k of keys) {
    const v = input[k];
    if (typeof v === 'number' && v >= 0 && v <= 100) used.push(k);
    else missing.push(k);
  }

  const completeness = used.reduce((s, k) => s + WEIGHTS[k], 0);
  const warnings: string[] = [];
  for (const k of missing) warnings.push(msg.missing(k));

  // Bootstrap path
  if (completeness === 0) {
    if (!hasHistory) {
      warnings.push(msg.bootstrap);
      return {
        drs_score: BOOTSTRAP_DRS,
        status: 'bootstrap',
        completeness: 0,
        is_partial: true,
        is_bootstrap: true,
        used_indicators: [],
        missing_indicators: missing,
        contributions: {},
        warnings,
      };
    }
    // Has history but no data today → treat as critical observability failure
    warnings.push(msg.insufficient(0));
    return {
      drs_score: 0,
      status: 'critical',
      completeness: 0,
      is_partial: true,
      is_bootstrap: false,
      used_indicators: [],
      missing_indicators: missing,
      contributions: {},
      warnings,
    };
  }

  // Renormalized weighted average
  const contributions: Partial<Record<IndicatorKey, number>> = {};
  let weightedSum = 0;
  for (const k of used) {
    const v = input[k] as number;
    const c = (v * WEIGHTS[k]) / completeness;
    contributions[k] = Math.round(c * 100) / 100;
    weightedSum += c;
  }
  const drs = Math.round(weightedSum);

  const isPartial = missing.length > 0;
  if (isPartial) {
    warnings.push(msg.partial(Math.round(completeness * 100)));
  }

  let status: DrsResult['status'];
  if (completeness < MIN_COMPLETENESS_FOR_VALID_DRS) {
    status = 'critical';
    warnings.push(msg.insufficient(Math.round(completeness * 100)));
  } else {
    status = statusFromDrs(drs);
  }

  return {
    drs_score: drs,
    status,
    completeness: Math.round(completeness * 100) / 100,
    is_partial: isPartial,
    is_bootstrap: false,
    used_indicators: used,
    missing_indicators: missing,
    contributions,
    warnings,
  };
}

// Build a single-line alert string for Telegram/Discord, locale-aware.
export function buildAlertText(
  reportDate: string,
  result: DrsResult,
  locale: Locale = 'en'
): string | null {
  const msg = t(locale);
  if (result.status === 'critical') return msg.alertCritical(reportDate, result.drs_score);
  if (result.status === 'caution') return msg.alertCaution(reportDate, result.drs_score);
  return null;
}
