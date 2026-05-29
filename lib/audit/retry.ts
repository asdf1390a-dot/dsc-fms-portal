// Audit Phase 2 — Network retry policy.
//
// Used by the daily cron when collecting external metrics (Supabase queries,
// Telegram/Discord delivery). Implements exponential backoff with full jitter.
//
// Policy (evaluator-approved):
//   - max attempts: 4 (1 initial + 3 retries)
//   - base delay: 500ms
//   - factor: 2.0 (500 → 1000 → 2000 → 4000 ms)
//   - jitter: full (sleep = random(0, computed_delay))
//   - overall budget: 15s — if the elapsed wall-clock exceeds the budget
//     before the next attempt, abort and surface the last error.
//   - retryable errors: network errors, 5xx, 429, timeouts. 4xx (non-429)
//     are treated as permanent and fail fast.

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  factor?: number;
  budgetMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxAttempts: 4,
  baseDelayMs: 500,
  factor: 2.0,
  budgetMs: 15_000,
};

export function defaultIsRetryable(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; code?: string; name?: string; message?: string };
  if (typeof e.status === 'number') {
    if (e.status === 429) return true;
    if (e.status >= 500 && e.status < 600) return true;
    return false; // 4xx (non-429) = permanent
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED' || e.code === 'EAI_AGAIN') return true;
  if (e.name === 'AbortError') return true;
  // Fetch network failures usually surface as TypeError with "fetch failed"
  if (e.name === 'TypeError' && /fetch/i.test(e.message ?? '')) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const cfg = { ...DEFAULTS, ...opts };
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;
  const start = Date.now();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === cfg.maxAttempts) break;
      if (!isRetryable(err)) break;

      const exp = cfg.baseDelayMs * Math.pow(cfg.factor, attempt - 1);
      const delay = Math.floor(Math.random() * exp); // full jitter
      const elapsed = Date.now() - start;
      if (elapsed + delay > cfg.budgetMs) break;

      opts.onRetry?.(attempt, delay, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
