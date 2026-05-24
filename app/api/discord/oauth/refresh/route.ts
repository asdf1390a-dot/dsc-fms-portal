// POST /api/discord/oauth/refresh
// Refresh stored Discord access token using the refresh_token on the owner's discord_configs row.
// Body: { guild_id: string }
import { authFromRequest, jsonError, jsonOk, DISCORD_API } from '@/lib/discord/api-helpers';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return jsonError('Discord OAuth env not configured', 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { guild_id } = body || {};
  if (!guild_id) return jsonError('guild_id required', 400);

  const { data: cfg, error: cfgErr } = await auth.client
    .from('discord_configs')
    .select('config_id, oauth_refresh_token')
    .eq('owner_id', auth.userId)
    .eq('guild_id', guild_id)
    .maybeSingle();

  if (cfgErr) return jsonError(cfgErr.message, 500);
  if (!cfg?.oauth_refresh_token) return jsonError('No refresh token on file', 404);

  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: cfg.oauth_refresh_token,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonError('Discord token refresh failed', 502, { detail: text });
  }

  const token = await res.json();
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 0) * 1000).toISOString();

  const { data, error } = await auth.client
    .from('discord_configs')
    .update({
      oauth_access_token: token.access_token,
      oauth_refresh_token: token.refresh_token ?? cfg.oauth_refresh_token,
      oauth_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('config_id', cfg.config_id)
    .select('config_id, oauth_expires_at')
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}
