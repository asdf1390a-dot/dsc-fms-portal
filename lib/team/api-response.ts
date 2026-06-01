// Team API response envelope helpers + shared TTL caching

export type APIResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  timestamp: string;
};

export function okJson<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function paginatedJson<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    timestamp: new Date().toISOString(),
  };
}

export function errorJson(
  code: "INVALID_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR",
  message: string
): APIResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };
}

// In-process TTL cache (Map-based, expires after TTL seconds)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlSeconds: number = 300): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

// Query parameter validator for pagination
export function parsePaging(query: Record<string, string | string[] | undefined>): {
  limit: number;
  offset: number;
  error?: string;
} {
  const limit = Math.min(Math.max(parseInt(String(query.limit || "20"), 10) || 20, 1), 100);
  const offset = Math.max(parseInt(String(query.offset || "0"), 10) || 0, 0);

  if (isNaN(limit) || isNaN(offset)) {
    return {
      limit,
      offset,
      error: "Invalid limit or offset",
    };
  }

  return { limit, offset };
}
