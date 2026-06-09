// pages/assets/scan.js
//
// Phase 3 — camera-based QR scan landing page.
//
// Uses the browser's native BarcodeDetector when available (Chromium / modern
// Android), and falls back to manual entry on iOS Safari and other clients.
// On a successful scan, the user is routed to /assets/quick-update?payload=...
// which handles the actual asset lookup (online via API, offline via cache).

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/use-auth';
import { useLanguage } from '../../lib/i18n/context';
import { t } from '../../lib/i18n/translations';
import { getCachedAssetCount } from '../../lib/assets/offline-cache';

export default function AssetScanPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const { language } = useLanguage();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [cacheCount, setCacheCount] = useState(0);
  const [online, setOnline] = useState(true);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/assets/scan')}`);
    }
  }, [authLoading, isAuthed, router]);

  // Online status + cache count
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    getCachedAssetCount().then(setCacheCount).catch(() => {});
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  function detectorAvailable() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  async function startCamera() {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(t('scan.no_camera', language));
      return;
    }
    if (!detectorAvailable()) {
      setError(t('scan.no_detector', language));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // eslint-disable-next-line no-undef
      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] });
      setCameraOn(true);
      tick();
    } catch (e) {
      setError(e?.message || 'camera_error');
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function tick() {
    if (!detectorRef.current || !videoRef.current) return;
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes && codes.length > 0) {
        const raw = String(codes[0].rawValue || '').trim();
        if (raw) {
          stopCamera();
          handlePayload(raw);
          return;
        }
      }
    } catch {
      // ignore frame-level errors, keep scanning
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePayload(payload) {
    router.push(`/assets/quick-update?payload=${encodeURIComponent(payload)}`);
  }

  function submitManual(e) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    handlePayload(v);
  }

  return (
    <>
      <Head>
        <title>{t('scan.title', language)} · DSC FMS</title>
      </Head>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link href="/assets" className="text-blue-600" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
              {t('common.back', language)}
            </Link>
            <span className={`text-xs px-2 py-1 rounded ${online ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {online ? '● online' : '◌ offline'}
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-1">{t('scan.title', language)}</h1>
          <p className="text-sm text-gray-600 mb-4">{t('scan.subtitle', language)}</p>

          {!online && (
            <div className="mb-3 text-sm bg-yellow-50 border border-yellow-200 text-yellow-900 rounded p-2">
              {t('scan.offline_mode', language)}
              {' · '}
              {t('scan.cache_count', language).replace('{n}', String(cacheCount))}
            </div>
          )}

          <div className="bg-black rounded overflow-hidden aspect-square mb-3 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
            />
            {!cameraOn && (
              <div className="text-gray-400 text-sm p-6 text-center">
                {detectorAvailable() ? t('scan.scanning', language).replace('...', '') : t('scan.no_detector', language)}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-800 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {!cameraOn ? (
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 bg-blue-600 text-white font-semibold rounded px-4 py-3"
                style={{ minHeight: 44 }}
              >
                {t('scan.start_camera', language)}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 bg-gray-700 text-white font-semibold rounded px-4 py-3"
                style={{ minHeight: 44 }}
              >
                {t('scan.stop_camera', language)}
              </button>
            )}
          </div>

          <form onSubmit={submitManual} className="bg-white rounded shadow p-4">
            <label className="block text-sm font-medium mb-2">{t('scan.manual_entry', language)}</label>
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={t('scan.manual_placeholder', language)}
              className="w-full border border-gray-300 rounded px-3 py-3 mb-3"
              style={{ fontSize: 16, minHeight: 44 }}
              autoComplete="off"
              inputMode="text"
            />
            <button
              type="submit"
              className="w-full bg-green-600 text-white font-semibold rounded px-4 py-3"
              style={{ minHeight: 44 }}
              disabled={!manual.trim()}
            >
              {t('scan.lookup', language)}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
