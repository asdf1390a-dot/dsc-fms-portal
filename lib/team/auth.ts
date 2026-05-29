// Team Dashboard Phase 2 — App Router auth helper.
// Decodes the Bearer JWT locally (no Supabase round-trip) so write endpoints
// can reject anonymous requests cheaply. Mirrors the asset-master pattern in
// lib/api-auth.js (decodeJWT / isTokenExpired).

import type { NextRequest } from 'next/server'

export interface DecodedJWT {
  sub?: string
  email?: string
  exp?: number
  role?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  [k: string]: unknown
}

export function decodeJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
    return JSON.parse(payload) as DecodedJWT
  } catch {
    return null
  }
}

export function isTokenExpired(payload: DecodedJWT | null): boolean {
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() >= payload.exp * 1000
}

export interface AuthResult {
  ok: boolean
  user: DecodedJWT | null
  reason?: 'missing_token' | 'invalid_token' | 'expired_token'
}

export function authenticateRequest(request: NextRequest | Request): AuthResult {
  const header =
    (request as any).headers?.get?.('authorization') ||
    (request as any).headers?.authorization ||
    ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return { ok: false, user: null, reason: 'missing_token' }
  const payload = decodeJWT(token)
  if (!payload) return { ok: false, user: null, reason: 'invalid_token' }
  if (isTokenExpired(payload)) return { ok: false, user: null, reason: 'expired_token' }
  return { ok: true, user: payload }
}

export function isAdmin(user: DecodedJWT | null): boolean {
  if (!user) return false
  const role =
    (user.user_metadata as any)?.role ||
    (user.app_metadata as any)?.role ||
    user.role
  return role === 'admin'
}
