// Audit Phase 2 — DRS calculator + retry unit tests.
//
// Covers the four evaluator concerns:
//   (1) Partial-data DRS  (renormalization + insufficiency)
//   (2) Bootstrap         (first-day default)
//   (3) Network retry     (backoff + non-retryable fast-fail)
//   (4) i18n              (en/ko/ta strings)

import {
  calculateDrs,
  buildAlertText,
  WEIGHTS,
  BOOTSTRAP_DRS,
} from '../lib/audit/drs-calculator';
import { withRetry, defaultIsRetryable } from '../lib/audit/retry';

describe('DRS Phase 2 — full data', () => {
  it('computes weighted average when all indicators present', () => {
    const r = calculateDrs({
      backup_recovery_rate: 100,
      storage_health_rate: 90,
      data_integrity_rate: 80,
      accessibility_rate: 70,
    });
    // 100*0.4 + 90*0.3 + 80*0.2 + 70*0.1 = 40 + 27 + 16 + 7 = 90
    expect(r.drs_score).toBe(90);
    expect(r.status).toBe('caution');
    expect(r.is_partial).toBe(false);
    expect(r.is_bootstrap).toBe(false);
    expect(r.completeness).toBe(1);
    expect(r.missing_indicators).toEqual([]);
  });

  it('maps DRS≥95 → good', () => {
    const r = calculateDrs({
      backup_recovery_rate: 100,
      storage_health_rate: 100,
      data_integrity_rate: 100,
      accessibility_rate: 50,
    });
    // 40 + 30 + 20 + 5 = 95
    expect(r.drs_score).toBe(95);
    expect(r.status).toBe('good');
  });

  it('maps DRS<85 → critical', () => {
    const r = calculateDrs({
      backup_recovery_rate: 50,
      storage_health_rate: 50,
      data_integrity_rate: 50,
      accessibility_rate: 50,
    });
    expect(r.drs_score).toBe(50);
    expect(r.status).toBe('critical');
  });
});

describe('DRS Phase 2 — (1) partial data renormalization', () => {
  it('renormalizes weights when one indicator is missing', () => {
    // Only backup(0.4) + storage(0.3) present → completeness=0.7
    const r = calculateDrs({
      backup_recovery_rate: 100,
      storage_health_rate: 100,
      data_integrity_rate: null,
      accessibility_rate: null,
    });
    expect(r.is_partial).toBe(true);
    expect(r.completeness).toBe(0.7);
    // (100*0.4 + 100*0.3) / 0.7 = 70/0.7 = 100
    expect(r.drs_score).toBe(100);
    expect(r.missing_indicators).toEqual([
      'data_integrity_rate',
      'accessibility_rate',
    ]);
    expect(r.warnings.some((w) => /Partial data/i.test(w))).toBe(true);
  });

  it('flags critical when completeness <50% even if values are high', () => {
    // Only accessibility(0.1) present → completeness=0.1 < 0.5
    const r = calculateDrs({
      backup_recovery_rate: null,
      storage_health_rate: null,
      data_integrity_rate: null,
      accessibility_rate: 100,
    });
    expect(r.status).toBe('critical');
    expect(r.is_partial).toBe(true);
    expect(r.completeness).toBe(0.1);
    expect(r.warnings.some((w) => /Insufficient data/i.test(w))).toBe(true);
  });

  it('rejects out-of-range values as missing', () => {
    const r = calculateDrs({
      backup_recovery_rate: 150 as unknown as number, // invalid
      storage_health_rate: -10 as unknown as number,  // invalid
      data_integrity_rate: 80,
      accessibility_rate: 90,
    });
    expect(r.used_indicators).toEqual([
      'data_integrity_rate',
      'accessibility_rate',
    ]);
    expect(r.is_partial).toBe(true);
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(1);
  });
});

describe('DRS Phase 2 — (2) bootstrap', () => {
  it('returns bootstrap status when no history and no data', () => {
    const r = calculateDrs(
      {
        backup_recovery_rate: null,
        storage_health_rate: null,
        data_integrity_rate: null,
        accessibility_rate: null,
      },
      { hasHistory: false }
    );
    expect(r.status).toBe('bootstrap');
    expect(r.drs_score).toBe(BOOTSTRAP_DRS);
    expect(r.is_bootstrap).toBe(true);
    expect(r.warnings.some((w) => /Bootstrap/i.test(w))).toBe(true);
  });

  it('returns critical when no data but history exists (observability failure)', () => {
    const r = calculateDrs(
      {
        backup_recovery_rate: null,
        storage_health_rate: null,
        data_integrity_rate: null,
        accessibility_rate: null,
      },
      { hasHistory: true }
    );
    expect(r.status).toBe('critical');
    expect(r.drs_score).toBe(0);
    expect(r.is_bootstrap).toBe(false);
  });
});

describe('DRS Phase 2 — (4) i18n', () => {
  it('emits Korean warnings under locale=ko', () => {
    const r = calculateDrs(
      {
        backup_recovery_rate: 100,
        storage_health_rate: null,
        data_integrity_rate: null,
        accessibility_rate: null,
      },
      { locale: 'ko' }
    );
    // Only backup → completeness=0.4 < 0.5 → 'insufficient' warning
    expect(r.warnings.some((w) => /데이터 부족|부분 데이터/.test(w))).toBe(true);
  });

  it('emits Tamil warnings under locale=ta', () => {
    const r = calculateDrs(
      {
        backup_recovery_rate: 100,
        storage_health_rate: 100,
        data_integrity_rate: null,
        accessibility_rate: null,
      },
      { locale: 'ta' }
    );
    expect(r.warnings.some((w) => /பகுதி தரவு|குறிகாட்டி/.test(w))).toBe(true);
  });

  it('builds locale-aware alert text', () => {
    const r = calculateDrs({
      backup_recovery_rate: 50,
      storage_health_rate: 50,
      data_integrity_rate: 50,
      accessibility_rate: 50,
    });
    const en = buildAlertText('2026-05-27', r, 'en');
    const ko = buildAlertText('2026-05-27', r, 'ko');
    const ta = buildAlertText('2026-05-27', r, 'ta');
    expect(en).toMatch(/CRITICAL/);
    expect(ko).toMatch(/CRITICAL/);
    expect(ta).toMatch(/CRITICAL/);
    expect(en).not.toBe(ko);
  });

  it('returns null alert for good status', () => {
    const r = calculateDrs({
      backup_recovery_rate: 100,
      storage_health_rate: 100,
      data_integrity_rate: 100,
      accessibility_rate: 100,
    });
    expect(buildAlertText('2026-05-27', r, 'en')).toBeNull();
  });
});

describe('Retry policy — (3) network retry', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries retryable errors up to maxAttempts', async () => {
    let calls = 0;
    const err = { status: 503, message: 'svc' };
    await expect(
      withRetry(
        async () => {
          calls++;
          throw err;
        },
        { maxAttempts: 3, baseDelayMs: 1, factor: 1.0, budgetMs: 1000 }
      )
    ).rejects.toEqual(err);
    expect(calls).toBe(3);
  });

  it('fast-fails on non-retryable 4xx', async () => {
    let calls = 0;
    const err = { status: 400, message: 'bad req' };
    await expect(
      withRetry(
        async () => {
          calls++;
          throw err;
        },
        { maxAttempts: 4, baseDelayMs: 1 }
      )
    ).rejects.toEqual(err);
    expect(calls).toBe(1);
  });

  it('classifies 429 + 5xx as retryable, 401 as not', () => {
    expect(defaultIsRetryable({ status: 429 })).toBe(true);
    expect(defaultIsRetryable({ status: 503 })).toBe(true);
    expect(defaultIsRetryable({ status: 401 })).toBe(false);
    expect(defaultIsRetryable({ code: 'ETIMEDOUT' })).toBe(true);
    expect(defaultIsRetryable({ code: 'ENOENT' })).toBe(false);
  });

  it('respects overall budget', async () => {
    let calls = 0;
    const err = { status: 503, message: 'svc' };
    await expect(
      withRetry(
        async () => {
          calls++;
          throw err;
        },
        { maxAttempts: 10, baseDelayMs: 50, factor: 2, budgetMs: 30 }
      )
    ).rejects.toEqual(err);
    // First call always runs. Subsequent calls blocked by budget exhaustion.
    expect(calls).toBeLessThan(10);
  });
});
