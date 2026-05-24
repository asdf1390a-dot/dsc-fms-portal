// Phase 1 Discord/Telegram sync API helpers.
// All routes use these to enforce per-owner RLS via Supabase JWT forwarding.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type AuthedRequest = {
  token: string;
  userId: string;
  client: SupabaseClient;
};

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ success: false, error: { message, ...extra } }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export async function authFromRequest(request: Request): Promise<AuthedRequest | Response> {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return jsonError('Missing bearer token', 401);

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return jsonError('Invalid or expired token', 401);
  return { token, userId: data.user.id, client };
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function contentHash(payload: { source: string; channel: string; content: string }) {
  return createHash('sha256')
    .update(`${payload.source}:${payload.channel}:${payload.content}`)
    .digest('hex');
}

export function previewOf(content: string, max = 200) {
  if (!content) return '';
  return content.length > max ? `${content.slice(0, max)}…` : content;
}

export async function logSync(opts: {
  client: SupabaseClient;
  ownerId: string;
  source: 'telegram' | 'discord' | 'ctb' | 'manual';
  target: 'telegram' | 'discord';
  sourceMsgId?: string | null;
  sourceChannelId?: string | null;
  sourceUserId?: string | null;
  targetMsgId?: string | null;
  targetChannelId?: string | null;
  content: string;
  status?: 'pending' | 'success' | 'fallback' | 'error' | 'duplicate' | 'skipped';
  errorMessage?: string | null;
  latencyMs?: number | null;
}) {
  const hash = contentHash({
    source: opts.source,
    channel: opts.sourceChannelId || '',
    content: opts.content || '',
  });
  const row = {
    owner_id: opts.ownerId,
    source_platform: opts.source,
    source_msg_id: opts.sourceMsgId ?? null,
    source_channel_id: opts.sourceChannelId ?? null,
    source_user_id: opts.sourceUserId ?? null,
    target_platform: opts.target,
    target_msg_id: opts.targetMsgId ?? null,
    target_channel_id: opts.targetChannelId ?? null,
    content_hash: hash,
    content_preview: previewOf(opts.content),
    sync_status: opts.status ?? 'pending',
    error_message: opts.errorMessage ?? null,
    latency_ms: opts.latencyMs ?? null,
    synced_at: opts.status === 'success' ? new Date().toISOString() : null,
  };
  const { data, error } = await opts.client
    .from('discord_sync_logs')
    .insert(row)
    .select()
    .single();
  return { data, error, hash };
}

export async function loadOwnerConfig(client: SupabaseClient, ownerId: string) {
  const { data, error } = await client
    .from('discord_configs')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('enabled', true)
    .maybeSingle();
  return { config: data, error };
}

export const DISCORD_API = 'https://discord.com/api/v10';
export const TELEGRAM_API = 'https://api.telegram.org';
