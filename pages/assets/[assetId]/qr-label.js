// pages/assets/[assetId]/qr-label.js
//
// Print-only QR label, 80mm x 80mm. Fetches the QR image via the existing
// /api/assets/[assetId]/qr?format=svg endpoint (anon-readable). Asset
// summary comes from the public `assets` table (anon select allowed).

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function QrLabelPage() {
  const router = useRouter();
  const { assetId } = router.query;
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      const isUuid = UUID_RE.test(String(assetId));
      const q = supabase
        .from('assets')
        .select('id, machine_asset_number, name_en, name_ko, qr_payload, location')
        .limit(1);
      const { data, error } = await (isUuid
        ? q.eq('id', assetId)
        : q.eq('machine_asset_number', assetId));
      if (cancelled) return;
      if (error) { setError(error.message); return; }
      if (!data || data.length === 0) { setError('자산을 찾을 수 없습니다'); return; }
      setAsset(data[0]);
    })();
    return () => { cancelled = true; };
  }, [assetId]);

  const qrSrc = asset ? `/api/assets/${encodeURIComponent(asset.id)}/qr?format=svg` : null;

  return (
    <>
      <Head>
        <title>{asset ? `${asset.machine_asset_number} 라벨` : 'QR 라벨'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{PRINT_CSS}</style>
      </Head>

      <main style={S.page}>
        <header style={S.header} className="no-print">
          {assetId ? (
            <Link href={`/assets/${encodeURIComponent(assetId)}`} style={S.backLink}>← 상세</Link>
          ) : <span style={S.backLink}>←</span>}
          <h1 style={S.title}>QR 라벨</h1>
          <button type="button" onClick={() => window.print()} style={S.printBtn} disabled={!asset}>
            인쇄
          </button>
        </header>

        {error ? (
          <div style={{ ...S.error, margin: 16 }} className="no-print">{error}</div>
        ) : !asset ? (
          <div style={{ ...S.muted, padding: 24 }} className="no-print">불러오는 중…</div>
        ) : null}

        {asset ? (
          <div className="label-page">
            <div className="label-box">
              <div className="qr-cell">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR" className="qr-img" />
              </div>
              <div className="info-cell">
                <div className="info-name">{asset.name_en || asset.name_ko || '—'}</div>
                <div className="info-no">{asset.machine_asset_number}</div>
                <div className="info-id">{asset.id}</div>
                {asset.location ? <div className="info-loc">{asset.location}</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ padding: 16 }} className="no-print">
          <div style={S.muted}>
            인쇄 시: 미리보기에서 80mm × 80mm 라벨용지 또는 A4(여백 0) 선택 권장. 배경 그래픽 활성화.
          </div>
        </div>
      </main>
    </>
  );
}

const PRINT_CSS = `
  /* Screen preview: center the label like a sheet */
  .label-page {
    display: flex; justify-content: center; padding: 24px;
    background: #f1f5f9;
  }
  .label-box {
    width: 80mm; height: 80mm; box-sizing: border-box;
    background: #fff; border: 1px solid #cbd5e1; border-radius: 6px;
    padding: 4mm;
    display: grid; grid-template-columns: 40mm 1fr; gap: 3mm;
    align-items: center;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #000;
  }
  .qr-cell { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  .qr-img { width: 100%; height: auto; max-height: 72mm; display: block; }
  .info-cell { display: flex; flex-direction: column; gap: 1.5mm; min-width: 0; }
  .info-name { font-size: 11pt; font-weight: 700; line-height: 1.15;
               word-break: break-word; overflow-wrap: anywhere; }
  .info-no   { font-size: 14pt; font-weight: 800; letter-spacing: 0.5px; }
  .info-id   { font-family: ui-monospace, SFMono-Regular, monospace;
               font-size: 7pt; color: #475569; word-break: break-all; }
  .info-loc  { font-size: 9pt; color: #334155; }

  @media print {
    @page { size: 80mm 80mm; margin: 0; }
    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
    .no-print { display: none !important; }
    .label-page { padding: 0; background: #fff; }
    .label-box { border: none; border-radius: 0; box-shadow: none; }
  }
`;

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#f1f5f9', minHeight: '100vh', color: '#0f172a',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  printBtn: {
    minHeight: 40, padding: '0 16px', fontSize: 15, fontWeight: 600,
    color: '#0f172a', background: '#fef3c7', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  muted: { fontSize: 13, color: '#64748b' },
  error: { padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 14 },
};
