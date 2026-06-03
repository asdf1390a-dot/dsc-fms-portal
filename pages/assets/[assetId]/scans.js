// pages/assets/[assetId]/scans.js
//
// Browse and filter scan history for a single asset.
// Calls GET /api/assets/[assetId]/scans (auth required).

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/use-auth';
import { supabase } from '../../../lib/supabase';

const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ScansPage() {
  const router = useRouter();
  const { assetId } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  const [asset, setAsset] = useState(null);
  const [assetError, setAssetError] = useState(null);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter inputs (committed on Apply).
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [scannedBy, setScannedBy] = useState(''); // UUID

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthed && assetId) {
      router.replace(`/login?next=${encodeURIComponent(`/assets/${assetId}/scans`)}`);
    }
  }, [authLoading, isAuthed, assetId, router]);

  // Asset summary (anon RLS allows select).
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      const isUuid = UUID_RE.test(String(assetId));
      const q = supabase
        .from('assets')
        .select('id, machine_asset_number, name_en, name_ko')
        .limit(1);
      const { data, error } = await (isUuid
        ? q.eq('id', assetId)
        : q.eq('machine_asset_number', assetId));
      if (cancelled) return;
      if (error) { setAssetError(error.message); return; }
      if (!data || data.length === 0) { setAssetError('자산을 찾을 수 없습니다'); return; }
      setAsset(data[0]);
    })();
    return () => { cancelled = true; };
  }, [assetId]);

  const fetchPage = useCallback(async (nextOffset) => {
    if (!asset?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('로그인이 필요합니다');

      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (fromDate) qs.set('from_date', fromDate);
      if (toDate) qs.set('to_date', toDate);
      if (scannedBy && UUID_RE.test(scannedBy)) qs.set('scanned_by', scannedBy);

      const r = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/scans?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 400) throw new Error(json?.error || '잘못된 쿼리 파라미터');
        if (r.status === 401) throw new Error('인증이 만료되었습니다. 다시 로그인하세요');
        if (r.status === 404) throw new Error('자산을 찾을 수 없습니다');
        throw new Error(json?.error || `조회 실패 (${r.status})`);
      }
      setRows(json.data || []);
      setTotal(json.total || 0);
      setHasMore(!!json.hasMore);
      setOffset(json.offset || 0);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [asset?.id, fromDate, toDate, scannedBy]);

  // Initial + filter-driven reload (reset to offset 0).
  useEffect(() => {
    if (asset?.id && isAuthed) {
      fetchPage(0);
    }
  }, [asset?.id, isAuthed, fetchPage]);

  // Unique scanned_by emails dropdown — derived from current page.
  const scannerOptions = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (r.scanned_by && !map.has(r.scanned_by)) {
        map.set(r.scanned_by, r.scanned_by_email || r.scanned_by.slice(0, 8));
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  function resetFilters() {
    setFromDate('');
    setToDate('');
    setScannedBy('');
  }

  return (
    <>
      <Head>
        <title>{asset ? `${asset.machine_asset_number} 스캔 기록` : '스캔 기록'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          {assetId ? (
            <Link href={`/assets/${encodeURIComponent(assetId)}`} style={S.backLink}>← 상세</Link>
          ) : <span style={S.backLink}>←</span>}
          <h1 style={S.title}>스캔 기록</h1>
          {assetId ? (
            <Link
              href={`/assets/${encodeURIComponent(assetId)}/qr-validate`}
              style={S.headerCta}
            >
              + 스캔
            </Link>
          ) : null}
        </header>

        <section style={S.summary}>
          {assetError ? (
            <div style={S.error}>{assetError}</div>
          ) : !asset ? (
            <div style={S.muted}>불러오는 중…</div>
          ) : (
            <>
              <div style={S.assetNo}>{asset.machine_asset_number}</div>
              <div style={S.muted}>{asset.name_en || asset.name_ko || '—'}</div>
            </>
          )}
        </section>

        <section style={S.filters}>
          <div style={S.filterGrid}>
            <label style={S.field}>
              <span style={S.fieldLabel}>From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={S.input}
              />
            </label>
            <label style={S.field}>
              <span style={S.fieldLabel}>To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={S.input}
              />
            </label>
            <label style={{ ...S.field, gridColumn: '1 / -1' }}>
              <span style={S.fieldLabel}>스캔자</span>
              <select
                value={scannedBy}
                onChange={(e) => setScannedBy(e.target.value)}
                style={S.input}
              >
                <option value="">— 전체 —</option>
                {scannerOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={S.filterRow}>
            <button type="button" onClick={() => fetchPage(0)} style={S.primaryBtn} disabled={loading}>
              {loading ? '조회 중…' : '필터 적용'}
            </button>
            <button type="button" onClick={resetFilters} style={S.secondaryBtn} disabled={loading}>
              초기화
            </button>
          </div>
        </section>

        {error ? <div style={{ ...S.error, margin: 16 }}>{error}</div> : null}

        <section style={{ padding: '0 16px' }}>
          <div style={S.totalBar}>
            총 {total.toLocaleString()}건
            {total > 0 ? (
              <span style={{ color: '#64748b' }}>
                {' '}· {offset + 1}–{Math.min(offset + rows.length, total)}
              </span>
            ) : null}
          </div>

          {rows.length === 0 && !loading ? (
            <div style={S.empty}>기록이 없습니다</div>
          ) : (
            <ul style={S.list}>
              {rows.map((r) => (
                <li key={r.id} style={S.row}>
                  <div style={S.rowHead}>
                    <span style={S.timestamp}>{formatTs(r.scanned_at)}</span>
                    <span style={S.email}>{r.scanned_by_email || (r.scanned_by ? r.scanned_by.slice(0, 8) : '—')}</span>
                  </div>
                  <div style={S.payload}>{r.qr_payload}</div>
                  <div style={S.meta}>
                    {r.location_gps ? (
                      <span style={S.metaItem}>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(r.location_gps)}`}
                          target="_blank" rel="noreferrer"
                          style={S.mapLink}
                        >📍 {r.location_gps}</a>
                      </span>
                    ) : null}
                    {r.device_info ? (
                      <span style={{ ...S.metaItem, color: '#94a3b8' }} title={r.device_info}>
                        {truncate(r.device_info, 48)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={S.pager}>
            <button
              type="button"
              onClick={() => fetchPage(Math.max(0, offset - PAGE_SIZE))}
              disabled={loading || offset <= 0}
              style={S.secondaryBtn}
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={() => fetchPage(offset + PAGE_SIZE)}
              disabled={loading || !hasMore}
              style={S.secondaryBtn}
            >
              다음 →
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

function formatTs(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString();
  } catch (_e) { return s; }
}
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#f8fafc', minHeight: '100vh', color: '#0f172a', paddingBottom: 60,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  headerCta: {
    color: '#0f172a', background: '#fef3c7', textDecoration: 'none',
    padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
  },
  summary: { padding: 16 },
  assetNo: { fontSize: 18, fontWeight: 700 },
  muted: { fontSize: 13, color: '#64748b' },
  filters: { margin: '0 16px 12px', padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 },
  filterGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', fontSize: 16,
    border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', outline: 'none',
  },
  filterRow: { display: 'flex', gap: 8, marginTop: 10 },
  primaryBtn: {
    minHeight: 44, padding: '0 16px', fontSize: 15, fontWeight: 600, flex: 2,
    color: '#fff', background: '#0f172a', border: 'none', borderRadius: 10, cursor: 'pointer',
  },
  secondaryBtn: {
    minHeight: 44, padding: '0 14px', fontSize: 15, fontWeight: 500, flex: 1,
    color: '#0f172a', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, cursor: 'pointer',
  },
  totalBar: { fontSize: 13, color: '#0f172a', margin: '8px 0 12px' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: 12,
  },
  rowHead: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  timestamp: { fontSize: 14, fontWeight: 600, color: '#0f172a' },
  email: { fontSize: 12, color: '#475569' },
  payload: {
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: 13, color: '#334155', marginTop: 6, wordBreak: 'break-all',
  },
  meta: { marginTop: 8, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 10 },
  metaItem: {},
  mapLink: { color: '#0369a1', textDecoration: 'underline' },
  empty: { padding: 32, textAlign: 'center', color: '#94a3b8' },
  pager: { display: 'flex', gap: 8, marginTop: 16, marginBottom: 24 },
  error: { padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 14 },
};
