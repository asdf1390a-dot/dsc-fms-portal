// ────────────────────────────────────────────────────────────────────────
// AttachmentManager
// 고정자산·처분 공통 첨부 UI (사진 + 파일).
//
// Props:
//   target:     'asset' | 'disposal'
//   targetId:   uuid (assets.id or fixed_asset_disposals.id)
//   context:    'register' | 'sale' | 'scrap' | 'other'
//   readOnly?:  boolean (기본 false)
//
// 동작:
//   - Supabase Storage 버킷 'asset-attachments' 직접 업로드 (authenticated)
//   - asset_attachments 테이블에 메타데이터 기록 (이력 관리)
//   - 이미지: 미리보기 / 기타: 파일 아이콘 + 파일명
// ────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'asset-attachments';

function isImage(mime, name) {
  if (mime && /^image\//i.test(mime)) return true;
  if (name && /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name)) return true;
  return false;
}
function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return '📕';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜';
  return '📄';
}
function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(2)}MB`;
}

export default function AttachmentManager({ target, targetId, context = 'register', readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const photoRef = useRef();
  const fileRef = useRef();

  const targetCol = target === 'disposal' ? 'disposal_id' : 'asset_id';

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('asset_attachments')
        .select('*')
        .eq(targetCol, targetId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setItems(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [targetId, targetCol]);

  async function uploadFiles(fileList, kind /* 'photo' | 'attachment' */) {
    if (!fileList?.length) return;
    setBusy(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다');
      const userId = session.user?.id;

      const created = [];
      for (const file of Array.from(fileList)) {
        const ts = Date.now();
        const safe = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `${target}/${context}/${targetId}/${ts}_${safe}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const row = {
          [targetCol]: targetId,
          file_url: pub.publicUrl,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size || null,
          storage_path: path,
          kind: kind === 'photo' ? 'photo' : 'attachment',
          context,
          uploaded_by: userId,
        };
        const { data: ins, error: insErr } = await supabase
          .from('asset_attachments')
          .insert(row)
          .select('*')
          .single();
        if (insErr) throw insErr;
        created.push(ins);
      }
      setItems(prev => [...created, ...prev]);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = '';
      if (fileRef.current)  fileRef.current.value = '';
    }
  }

  async function removeItem(item) {
    if (!confirm(`${item.file_name} 삭제하시겠습니까?`)) return;
    setBusy(true); setError(null);
    try {
      if (item.storage_path) {
        await supabase.storage.from(BUCKET).remove([item.storage_path]);
      }
      const { error: delErr } = await supabase
        .from('asset_attachments').delete().eq('id', item.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(x => x.id !== item.id));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const photos = items.filter(x => x.kind === 'photo' || isImage(x.file_type, x.file_name));
  const files  = items.filter(x => !(x.kind === 'photo' || isImage(x.file_type, x.file_name)));

  if (loading) return <div style={S.loading}>불러오는 중…</div>;

  return (
    <div>
      {/* 사진 */}
      {photos.length > 0 && (
        <div style={S.photoGrid}>
          {photos.map(p => (
            <div key={p.id} style={S.photoTile}>
              <a href={p.file_url} target="_blank" rel="noopener">
                <img src={p.file_url} alt={p.file_name} style={S.photoImg} />
              </a>
              {!readOnly && (
                <button type="button" onClick={() => removeItem(p)} disabled={busy}
                  style={S.delBtn} aria-label="Delete">×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 파일 */}
      {files.length > 0 && (
        <ul style={S.fileList}>
          {files.map(f => (
            <li key={f.id} style={S.fileItem}>
              <a href={f.file_url} target="_blank" rel="noopener" style={S.fileLink}>
                {fileIcon(f.file_name)} {f.file_name}
                <span style={S.fileSize}> {fmtSize(f.file_size)}</span>
              </a>
              {!readOnly && (
                <button type="button" onClick={() => removeItem(f)} disabled={busy}
                  style={S.delBtnSm} aria-label="Delete">×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div style={S.btnRow}>
          <label style={S.uploadBtn}>
            {busy ? '업로드 중…' : '📷 사진 추가'}
            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple
              onChange={(e) => uploadFiles(e.target.files, 'photo')}
              disabled={busy} style={{ display: 'none' }} />
          </label>
          <label style={S.uploadBtn}>
            {busy ? '업로드 중…' : '📎 파일 추가'}
            <input ref={fileRef} type="file" multiple
              onChange={(e) => uploadFiles(e.target.files, 'attachment')}
              disabled={busy} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {items.length === 0 && readOnly && (
        <div style={S.empty}>첨부 없음</div>
      )}

      {error && <div style={S.error}>{error}</div>}
    </div>
  );
}

const S = {
  loading: { padding: 12, color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  empty: { padding: 12, color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 },
  photoTile: { position: 'relative' },
  photoImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' },
  delBtn: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.65)', color: '#fff',
    width: 26, height: 26, borderRadius: '50%', border: 'none',
    fontSize: 16, lineHeight: '22px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fileList: { listStyle: 'none', margin: '0 0 10px', padding: 0,
    display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 8,
  },
  fileLink: { flex: 1, color: '#1d4ed8', textDecoration: 'none', fontSize: 13,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize: { color: '#94a3b8', fontSize: 11, marginLeft: 6 },
  delBtnSm: {
    background: '#e2e8f0', color: '#475569', border: 'none',
    width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
    fontSize: 14, lineHeight: '20px',
  },
  btnRow: { display: 'flex', gap: 8 },
  uploadBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px', border: '2px dashed #cbd5e1', borderRadius: 10,
    background: '#f8fafc', color: '#475569',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 48,
  },
  error: {
    marginTop: 8, padding: 10,
    background: '#fee2e2', color: '#991b1b',
    borderRadius: 8, fontSize: 13,
  },
};
