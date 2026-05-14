// Tiny client helper for the Backup App pages.
// All endpoints under /api/backup/* require a Bearer JWT.

import { supabase } from './supabase';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다');
  return { Authorization: `Bearer ${token}` };
}

export async function apiGet(path) {
  const headers = await authHeaders();
  const res = await fetch(path, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function apiPost(path, payload) {
  const headers = {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
  };
  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}
