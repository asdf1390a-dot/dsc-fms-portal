'use client';

// app/assets/quick-update/page.tsx
//
// Phase 3 — field-friendly quick update form (App Router).
//
// Flow:
//   1. Read `?payload=` from the URL (set by /assets/scan or typed in directly).
//   2. Resolve asset:
//        - online → GET /api/assets/qr-validate?payload=...
//        - offline → IndexedDB cache lookup
//   3. Show a compact form: status / location / note.
//   4. Save:
//        - online → POST /api/assets/[id]/quick-update
//        - offline → enqueue in IndexedDB, drain on next 'online' event.

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/use-auth';
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';
import { supabase } from '@/lib/supabase';
import {
  findCachedByPayload,
  queueUpdate,
  getPendingCount,
  syncPending,
} from '@/lib/assets/offline-cache';

const STATUS_OPTIONS = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];

type AssetView = {
  id: string;
  machine_asset_number?: string | null;
  name?: string | null;
  location?: string | null;
  status?: string | null;
};

function QuickUpdateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const payload = searchParams?.get('payload') || '';
  const { isAuthed, loading: authLoading } = useAuth() as { isAuthed: boolean; loading: boolean };
  const { language } = useLanguage();

  const [asset, setAsset] = useState<AssetView | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const getAuthHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const drainPending = useCallback(async () => {
    try {
      const { synced } = await syncPending(getAuthHeader);
      const count = await getPendingCount();
      setPendingCount(count);
      if (synced > 0) {
        setSavedMsg(t('quick.synced', language).replace('{n}', String(synced)));
      }
    } catch {
      // swallow — keep UI usable
    }
  }, [getAuthHeader, language]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      const next = pathname ? `${pathname}${payload ? `?payload=${encodeURIComponent(payload)}` : ''}` : '/assets/quick-update';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, isAuthed, router, pathname, payload]);

  // Online tracker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      // Auto-drain on reconnect
      drainPending();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    getPendingCount().then(setPendingCount).catch(() => {});
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve payload → asset
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLookupError(null);
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          const res = await fetch(`/api/assets/qr-validate?payload=${encodeURIComponent(payload)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const body = await res.json();
            if (cancelled) return;
            setAsset({
              id: body.asset_id,
              machine_asset_number: body.machine_asset_number,
              name: body.asset_name,
              location: body.location,
              status: body.status,
            });
            setStatus(body.status || '');
            setLocation(body.location || '');
            return;
          }
          if (res.status === 404) {
            setLookupError('asset_not_found');
            return;
          }
        }
        // Offline fallback
        const cached = await findCachedByPayload(payload);
        if (cancelled) return;
        if (!cached) {
          setLookupError('asset_not_found_offline');
          return;
        }
        setAsset({
          id: cached.id,
          machine_asset_number: cached.machine_asset_number,
          name: cached.name_en || cached.name_ko || cached.machine_asset_number,
          location: cached.location,
          status: cached.status,
        });
        setStatus(cached.status || '');
        setLocation(cached.location || '');
      } catch (e: any) {
        if (!cancelled) setLookupError(e?.message || 'lookup_error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [payload]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!asset?.id) return;
    setSaving(true);
    setSavedMsg(null);

    const patch: Record<string, any> = {};
    if (status && status !== asset.status) patch.status = status;
    if (location !== undefined && location !== (asset.location || '')) patch.location = location;
    if (Object.keys(patch).length === 0 && !note.trim()) {
      setSaving(false);
      setSavedMsg('No changes');
      return;
    }

    const body = { patch, note: note.trim() || null, client_ts: Date.now() };

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const auth = await getAuthHeader();
        const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/quick-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: auth } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        setSavedMsg('OK');
        // Refresh asset card from response.
        const j = await res.json();
        if (j?.asset) {
          setAsset((prev) => ({ ...(prev as AssetView), ...j.asset, name: prev?.name }));
        }
        setNote('');
        return;
      } catch (err) {
        // Network blip during save → enqueue offline.
        await queueUpdate({ asset_id: asset.id, patch, note: body.note });
        const c = await getPendingCount();
        setPendingCount(c);
        setSavedMsg(t('quick.queued_offline', language));
      } finally {
        setSaving(false);
      }
    } else {
      await queueUpdate({ asset_id: asset.id, patch, note: body.note });
      const c = await getPendingCount();
      setPendingCount(c);
      setSavedMsg(t('quick.queued_offline', language));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <Link href="/assets/scan" className="text-blue-600" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            {t('common.back', language)}
          </Link>
          <span className={`text-xs px-2 py-1 rounded ${online ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {online ? '● online' : '◌ offline'}
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-3">{t('quick.title', language)}</h1>

        {pendingCount > 0 && (
          <div className="mb-3 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded p-2 flex items-center justify-between">
            <span>{t('quick.pending_count', language).replace('{n}', String(pendingCount))}</span>
            {online && (
              <button
                onClick={drainPending}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                style={{ minHeight: 32 }}
              >
                {t('quick.sync_now', language)}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500">…</div>
        ) : lookupError ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
            {lookupError}
          </div>
        ) : asset ? (
          <>
            <div className="bg-white rounded shadow p-3 mb-3">
              <div className="text-xs text-gray-500">{asset.machine_asset_number}</div>
              <div className="font-semibold text-lg">{asset.name || '—'}</div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded shadow p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('quick.status', language)}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-3"
                  style={{ fontSize: 16, minHeight: 44 }}
                >
                  <option value="">—</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(`status.${s}`, language)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('quick.location', language)}</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-3"
                  style={{ fontSize: 16, minHeight: 44 }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('quick.note', language)}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  style={{ fontSize: 16 }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-green-600 text-white font-semibold rounded px-4 py-3 disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {saving ? t('quick.saving', language) : t('quick.save', language)}
              </button>

              {savedMsg && (
                <div className="text-sm text-center text-gray-700 mt-2">{savedMsg}</div>
              )}
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function QuickUpdatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-4 text-gray-500">…</div>}>
      <QuickUpdateInner />
    </Suspense>
  );
}
