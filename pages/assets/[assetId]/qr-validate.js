// pages/assets/[assetId]/qr-validate.js
//
// Mobile QR validation landing.
//  - Captures geolocation on mount.
//  - Lets operator paste/type a QR payload (camera scanner deferred — manual
//    entry covers the offline-paper-label case and works on every device).
//  - Resolves the payload via GET /api/assets/qr-validate to confirm it points
//    to the same asset we're on.
//  - Logs the scan via POST /api/assets/[assetId]/scans.
//  - On success, navigates to the scan history page.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/use-auth';
import { supabase } from '../../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function QrValidatePage() {
  const router = useRouter();
  const { assetId } = router.query;
  const { isAuthed, loading: authLoading, user } = useAuth();

  const [asset, setAsset] = useState(null);
  const [assetError, setAssetError] = useState(null);

  const [gps, setGps] = useState(null); // { lat, lon, accuracy } | null
  const [gpsError, setGpsError] = useState(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const [payload, setPayload] = useState('');
  const [validation, setValidation] = useState(null); // resolved asset summary | null
  const [validating, setValidating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitOk, setSubmitOk] = useState(null);

  const inputRef = useRef(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthed && assetId) {
      router.replace(`/login?next=${encodeURIComponent(`/assets/${assetId}/qr-validate`)}`);
    }
  }, [authLoading, isAuthed, assetId, router]);

  // Load asset summary (anon select allowed on assets).
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      const isUuid = UUID_RE.test(String(assetId));
      const q = supabase
        .from('assets')
        .select('id, machine_asset_number, name_en, name_ko, location, status')
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

  // Capture geolocation on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('이 기기는 위치 정보를 지원하지 않습니다');
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsBusy(false);
      },
      (err) => {
        setGpsError(err?.message || '위치 정보를 가져오지 못했습니다');
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  async function authHeader() {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) throw new Error('로그인이 필요합니다');
    return { Authorization: `Bearer ${token}` };
  }

  async function validatePayload() {
    setValidation(null);
    setSubmitError(null);
    const p = payload.trim();
    if (!p) { setSubmitError('QR 페이로드를 입력하세요'); return; }
    setValidating(true);
    try {
      const headers = await authHeader();
      const r = await fetch(`/api/assets/qr-validate?payload=${encodeURIComponent(p)}`, { headers });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) throw new Error('해당 QR과 매칭되는 자산이 없습니다');
        if (r.status === 401) throw new Error('인증이 만료되었습니다. 다시 로그인하세요');
        throw new Error(json?.error || `검증 실패 (${r.status})`);
      }
      setValidation(json);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function submitScan() {
    setSubmitError(null);
    setSubmitOk(null);
    const p = payload.trim();
    if (!p) { setSubmitError('QR 페이로드를 입력하세요'); return; }
    setSubmitting(true);
    try {
      const headers = {
        ...(await authHeader()),
        'Content-Type': 'application/json',
      };
      const body = {
        qr_payload: p,
        device_info: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        location_gps: gps ? `${gps.lat.toFixed(6)},${gps.lon.toFixed(6)}` : undefined,
      };
      const r = await fetch(`/api/assets/${encodeURIComponent(asset?.id || assetId)}/scans`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 400) throw new Error(json?.error || '요청 형식이 올바르지 않습니다');
        if (r.status === 401) throw new Error('인증이 만료되었습니다. 다시 로그인하세요');
        if (r.status === 404) throw new Error('자산을 찾을 수 없습니다');
        throw new Error(json?.error || `스캔 등록 실패 (${r.status})`);
      }
      setSubmitOk({ at: json.scanned_at, id: json.id });
      setTimeout(() => {
        router.push(`/assets/${encodeURIComponent(asset?.id || assetId)}/scans`);
      }, 1100);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function retryGps() {
    setGpsError(null);
    setGps(null);
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsBusy(false);
      },
      (err) => { setGpsError(err?.message || '위치 정보를 가져오지 못했습니다'); setGpsBusy(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <>
      <Head>
        <title>{asset ? `${asset.machine_asset_number} 스캔` : 'QR 스캔'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          {assetId ? (
            <Link href={`/assets/${encodeURIComponent(assetId)}`} style={S.backLink}>← 상세</Link>
          ) : <span style={S.backLink}>←</span>}
          <h1 style={S.title}>QR 스캔 등록</h1>
        </header>

        <section style={S.card}>
          <div style={S.label}>대상 자산</div>
          {assetError ? (
            <div style={S.error}>{assetError}</div>
          ) : !asset ? (
            <div style={S.muted}>불러오는 중…</div>
          ) : (
            <>
              <div style={S.assetNo}>{asset.machine_asset_number}</div>
              <div style={S.assetName}>{asset.name_en || asset.name_ko || '—'}</div>
              {asset.location ? <div style={S.muted}>위치: {asset.location}</div> : null}
            </>
          )}
        </section>

        <section style={S.card}>
          <div style={S.label}>현재 위치 (GPS)</div>
          {gpsBusy ? (
            <div style={S.muted}>위치 확인 중…</div>
          ) : gps ? (
            <div style={S.gpsOk}>
              <div style={S.gpsCoord}>{gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}</div>
              <div style={S.muted}>±{Math.round(gps.accuracy)} m</div>
            </div>
          ) : (
            <div style={S.gpsWarn}>
              <div style={{ color: '#92400e', marginBottom: 8 }}>{gpsError || '위치 미확보'}</div>
              <button type="button" onClick={retryGps} style={S.secondaryBtn}>다시 시도</button>
            </div>
          )}
        </section>

        <section style={S.card}>
          <div style={S.label}>QR 페이로드</div>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={payload}
            onChange={(e) => { setPayload(e.target.value); setValidation(null); }}
            placeholder="QR 코드 값 또는 URL을 입력/붙여넣기"
            style={S.input}
          />
          <div style={S.row}>
            <button
              type="button"
              onClick={validatePayload}
              disabled={validating || !payload.trim()}
              style={{ ...S.secondaryBtn, flex: 1 }}
            >
              {validating ? '확인 중…' : 'QR 확인'}
            </button>
            <button
              type="button"
              onClick={submitScan}
              disabled={submitting || !payload.trim()}
              style={{ ...S.primaryBtn, flex: 2 }}
            >
              {submitting ? '등록 중…' : '스캔 등록'}
            </button>
          </div>
          <div style={S.helper}>
            카메라 스캐너가 있는 기기에서는 외부 스캐너 앱이 채워준 값을 그대로 사용할 수 있습니다.
          </div>
        </section>

        {validation ? (
          <section style={{ ...S.card, background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <div style={S.label}>매칭된 자산</div>
            <div style={S.assetNo}>{validation.machine_asset_number}</div>
            <div style={S.assetName}>{validation.asset_name || '—'}</div>
            {validation.asset_id !== (asset?.id) ? (
              <div style={{ ...S.error, marginTop: 8 }}>
                ⚠ 이 페이지의 자산({asset?.machine_asset_number || assetId})과 다릅니다.
              </div>
            ) : (
              <div style={{ color: '#047857', marginTop: 8 }}>✓ 페이지 자산과 일치합니다</div>
            )}
          </section>
        ) : null}

        {submitError ? <div style={{ ...S.error, margin: 16 }}>{submitError}</div> : null}
        {submitOk ? (
          <div style={{ ...S.success, margin: 16 }}>
            ✓ 스캔이 등록되었습니다 — {new Date(submitOk.at).toLocaleString()}
            <div style={S.muted}>스캔 기록으로 이동합니다…</div>
          </div>
        ) : null}

        {assetId ? (
          <div style={{ padding: '0 16px 24px' }}>
            <Link href={`/assets/${encodeURIComponent(assetId)}/scans`} style={S.textLink}>
              스캔 기록 보기 →
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#f8fafc', minHeight: '100vh', color: '#0f172a', paddingBottom: 40,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  card: {
    margin: 16, padding: 16, background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: 12,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  assetNo: { fontSize: 20, fontWeight: 700, color: '#0f172a' },
  assetName: { fontSize: 15, color: '#334155', marginTop: 2 },
  muted: { fontSize: 13, color: '#64748b', marginTop: 4 },
  gpsOk: { padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 },
  gpsCoord: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 15, color: '#065f46' },
  gpsWarn: { padding: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', fontSize: 16,
    border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff',
    outline: 'none',
  },
  row: { display: 'flex', gap: 8, marginTop: 12 },
  primaryBtn: {
    minHeight: 48, padding: '0 16px', fontSize: 16, fontWeight: 600,
    color: '#fff', background: '#0f172a', border: 'none', borderRadius: 10, cursor: 'pointer',
  },
  secondaryBtn: {
    minHeight: 48, padding: '0 14px', fontSize: 15, fontWeight: 500,
    color: '#0f172a', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, cursor: 'pointer',
  },
  helper: { fontSize: 12, color: '#64748b', marginTop: 8 },
  error: { padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 14 },
  success: { padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 10, fontSize: 14 },
  textLink: { color: '#0f172a', textDecoration: 'underline', fontSize: 15 },
};
