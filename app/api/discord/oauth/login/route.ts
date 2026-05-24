// POST /api/discord/oauth/login
// Exchange Discord OAuth2 authorization code for access/refresh tokens and store on discord_configs.
// Body: { code: string, redirect_uri: string, guild_id: string, application_id?: string, public_key?: string }
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

  const { code, redirect_uri, guild_id, application_id, public_key } = body || {};
  if (!code || !redirect_uri || !guild_id) {
    return jsonError('code, redirect_uri, guild_id are required', 400);
  }

  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri,
  });

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return jsonError('Discord token exchange failed', 502, { detail: text });
  }

  const token = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 0) * 1000).toISOString();

  const upsert = {
    owner_id: auth.userId,
    guild_id,
    application_id: application_id ?? null,
    public_key: public_key ?? null,
    oauth_access_token: token.access_token,
    oauth_refresh_token: token.refresh_token,
    oauth_expires_at: expiresAt,
    oauth_scopes: typeof token.scope === 'string' ? token.scope.split(' ') : null,
    enabled: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.client
    .from('discord_configs')
    .upsert(upsert, { onConflict: 'owner_id,guild_id' })
    .select('config_id, guild_id, oauth_expires_at, enabled')
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
