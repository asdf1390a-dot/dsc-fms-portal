// Shared helpers for /api/team-dashboard/* App Router routes.
// Single source of truth for: Supabase admin client, auth check, JSON helpers,
// pagination parsing. Mirrors the conventions used in /api/team/* but with a
// stricter response envelope so the dashboard UI can rely on { success, data }.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

export function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function ok<T>(data: T, extra: Record<string, any> = {}, status = 200): Response {
  return json({ success: true, data, ...extra, timestamp: new Date().toISOString() }, status);
}

export function fail(
  code: 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR',
  message: string,
  status = 400,
  details?: any
): Response {
  return json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      timestamp: new Date().toISOString(),
    },
    status
  );
}

export function getUserId(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.substring(7), jwtSecret) as any;
    return decoded?.sub || null;
  } catch {
    return null;
  }
}

export function parsePaging(url: URL, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || String(defaultLimit), 10) || defaultLimit, 1),
    maxLimit
  );
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  return { limit, offset };
}
