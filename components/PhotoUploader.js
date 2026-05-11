import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function PhotoUploader({ asset, onPhotosChange }) {
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function uploadFiles(files) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      let latestPhotos = asset.photos || [];
      for (const file of files) {
        if (!/^image\//.test(file.type)) {
          setError(`Skipped non-image: ${file.name}`);
          continue;
        }
        const dataUrl = await readDataUrl(file);
        const r = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            asset_id: asset.id,
            filename: file.name,
            content_type: file.type,
            data: dataUrl,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        latestPhotos = j.photos;
        onPhotosChange?.(latestPhotos);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deletePhoto(url) {
    if (!confirm('Delete this photo?')) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/photos/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ asset_id: asset.id, url }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onPhotosChange?.(j.photos);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const photos = asset.photos || [];

  return (
    <div>
      {photos.length > 0 && (
        <div style={S.grid}>
          {photos.map((p, i) => (
            <div key={p} style={S.tile}>
              <a href={p} target="_blank" rel="noopener">
                <img src={p} alt={`photo ${i + 1}`} style={S.img} />
              </a>
              <button onClick={() => deletePhoto(p)} disabled={busy} style={S.deleteBtn} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        multiple
        onChange={(e) => uploadFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
        ...S.addBtn, ...(busy ? S.btnBusy : null),
      }}>
        {busy ? 'Uploading…' : photos.length === 0 ? '📷 Add first photo' : '+ Add photo'}
      </button>

      {error && <div style={S.error}>{error}</div>}
    </div>
  );
}

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  tile: { position: 'relative' },
  img: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' },
  deleteBtn: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    width: 24, height: 24, borderRadius: '50%', border: 'none',
    fontSize: 16, lineHeight: '20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: '100%', padding: '14px', borderRadius: 10,
    border: '2px dashed #cbd5e1', background: '#f8fafc', color: '#475569',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnBusy: { opacity: 0.6, cursor: 'wait' },
  error: {
    marginTop: 8, padding: 10,
    background: '#fee2e2', color: '#991b1b',
    borderRadius: 8, fontSize: 13,
  },
};
