// components/bm/BreakdownForm.tsx
// BM-P1 Phase 2 M3.3 — Create Breakdown Form.
// Inline CSS-in-JS dark theme matching pages/bm/*.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BreakdownCategory,
  BreakdownSeverity,
  createBreakdown,
  searchAssets,
} from '../../lib/hooks/useBreakdowns';
import { supabase } from '../../lib/supabase';

const SEVERITY_OPTIONS: { value: BreakdownSeverity; label: string }[] = [
  { value: 'minor', label: 'Minor / 경미' },
  { value: 'normal', label: 'Normal / 정상' },
  { value: 'major', label: 'Major / 주요' },
  { value: 'line_down', label: 'Line Down / 라인다운' },
];

const CATEGORY_OPTIONS: { value: BreakdownCategory; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical / 기계' },
  { value: 'electrical', label: 'Electrical / 전기' },
  { value: 'hydraulic', label: 'Hydraulic / 유압' },
  { value: 'software', label: 'Software / S/W' },
  { value: 'operator_error', label: 'Operator Error / 작업자' },
  { value: 'unknown', label: 'Unknown / 미상' },
];

interface AssetOption {
  id: string;
  machine_asset_number: string;
  name_en: string | null;
  location: string | null;
}

interface UploadedFile {
  url: string;
  name: string;
  size: number;
}

interface Props {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  redirectAfter?: boolean;
}

export default function BreakdownForm({ onSuccess, onCancel, redirectAfter = true }: Props) {
  const router = useRouter();

  // Form state
  const [assetId, setAssetId] = useState('');
  const [assetLabel, setAssetLabel] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionTa, setDescriptionTa] = useState('');
  const [severity, setSeverity] = useState<BreakdownSeverity>('normal');
  const [category, setCategory] = useState<BreakdownCategory | ''>('');
  const [startedAt, setStartedAt] = useState('');
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [documents, setDocuments] = useState<UploadedFile[]>([]);

  // Asset picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<AssetOption[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── Asset search ─────────────────────────────────────────────────
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchAssets(pickerQuery, 20);
        if (!cancelled) setPickerResults(rows);
      } catch (e: any) {
        if (!cancelled) setPickerResults([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickerOpen, pickerQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [pickerOpen]);

  // ── Validation ───────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!assetId) e.assetId = 'Asset is required / 자산 선택 필요';
    if (!description || description.trim().length < 1) {
      e.description = 'Description is required / 증상 입력 필요';
    } else if (description.trim().length > 4000) {
      e.description = 'Max 4000 characters';
    }
    return e;
  }, [assetId, description]);

  const valid = Object.keys(errors).length === 0;

  // ── File upload via Supabase Storage ─────────────────────────────
  async function uploadFiles(files: FileList | null, kind: 'photo' | 'document') {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) throw new Error('Not signed in / 로그인 필요');

      const uploaded: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (kind === 'photo' && !/^image\//.test(file.type)) {
          setError(`Skipped non-image: ${file.name}`);
          continue;
        }
        const bucket = 'asset-photos'; // shared bucket for now
        const filename = `breakdowns/${Date.now()}-${i}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(filename, file, { upsert: false, contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filename);
        uploaded.push({ url: pub.publicUrl, name: file.name, size: file.size });
      }
      if (kind === 'photo') setPhotos((prev) => [...prev, ...uploaded]);
      else setDocuments((prev) => [...prev, ...uploaded]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  }

  function removePhoto(url: string) {
    setPhotos((p) => p.filter((f) => f.url !== url));
  }
  function removeDocument(url: string) {
    setDocuments((p) => p.filter((f) => f.url !== url));
  }

  // ── Submit ───────────────────────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!valid) {
      setError('Please fix the highlighted fields / 입력 항목을 확인하세요');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createBreakdown({
        asset_id: assetId,
        description: description.trim(),
        description_ta: descriptionTa.trim() || undefined,
        severity,
        category: category || undefined,
        started_at: startedAt || undefined,
        photos: photos.map((p) => p.url),
        documents: documents.map((d) => d.url),
      });
      setToast('Breakdown reported / 고장 신고 완료');
      if (onSuccess) onSuccess(created.id);
      if (redirectAfter) {
        setTimeout(() => router.push('/breakdowns'), 700);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create breakdown');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={S.form} noValidate>
      {/* Asset picker */}
      <div style={S.field} ref={pickerRef}>
        <label htmlFor="bm-asset" style={S.label}>
          Asset <span style={S.req}>*</span>
        </label>
        <button
          id="bm-asset"
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          style={{
            ...S.input,
            textAlign: 'left',
            color: assetLabel ? '#f1f5f9' : '#64748b',
          }}
        >
          {assetLabel || 'Search asset by number or name…'}
        </button>
        {errors.assetId && <div style={S.err}>{errors.assetId}</div>}

        {pickerOpen && (
          <div role="listbox" style={S.picker}>
            <input
              autoFocus
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Type to search…"
              style={{ ...S.input, marginBottom: 8 }}
              aria-label="Search assets"
            />
            {pickerLoading && <div style={S.pickerMsg}>Loading…</div>}
            {!pickerLoading && pickerResults.length === 0 && (
              <div style={S.pickerMsg}>No assets match</div>
            )}
            <ul style={S.pickerList}>
              {pickerResults.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAssetId(a.id);
                      setAssetLabel(
                        `${a.machine_asset_number}${a.name_en ? ` · ${a.name_en}` : ''}`
                      );
                      setPickerOpen(false);
                      setPickerQuery('');
                    }}
                    style={S.pickerItem}
                    aria-label={`Select ${a.machine_asset_number}`}
                  >
                    <span style={S.pickerCode}>{a.machine_asset_number}</span>
                    {a.name_en && <span style={S.pickerName}> · {a.name_en}</span>}
                    {a.location && <div style={S.pickerLoc}>{a.location}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Description */}
      <div style={S.field}>
        <label htmlFor="bm-desc" style={S.label}>
          Description / 증상 <span style={S.req}>*</span>
        </label>
        <textarea
          id="bm-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what went wrong…"
          rows={4}
          style={{ ...S.input, fontFamily: 'inherit', minHeight: 96 }}
          aria-invalid={!!errors.description}
          aria-describedby="bm-desc-err"
        />
        {errors.description && (
          <div id="bm-desc-err" style={S.err}>
            {errors.description}
          </div>
        )}
      </div>

      {/* Description (Tamil) */}
      <div style={S.field}>
        <label htmlFor="bm-desc-ta" style={S.label}>
          Description (Tamil) / தமிழ் — optional
        </label>
        <textarea
          id="bm-desc-ta"
          value={descriptionTa}
          onChange={(e) => setDescriptionTa(e.target.value)}
          placeholder="தமிழில் விளக்கம்…"
          rows={3}
          style={{ ...S.input, fontFamily: 'inherit', minHeight: 72 }}
          lang="ta"
        />
      </div>

      {/* Severity */}
      <div style={S.field}>
        <label htmlFor="bm-sev" style={S.label}>
          Severity / 심각도
        </label>
        <select
          id="bm-sev"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as BreakdownSeverity)}
          style={S.input}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div style={S.field}>
        <label htmlFor="bm-cat" style={S.label}>
          Category / 분류 — optional
        </label>
        <select
          id="bm-cat"
          value={category}
          onChange={(e) => setCategory((e.target.value as BreakdownCategory) || '')}
          style={S.input}
        >
          <option value="">— Select —</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Started at */}
      <div style={S.field}>
        <label htmlFor="bm-start" style={S.label}>
          Started at / 시작 시각 — optional
        </label>
        <input
          id="bm-start"
          type="datetime-local"
          value={startedAt}
          onChange={(e) => setStartedAt(e.target.value)}
          style={S.input}
        />
      </div>

      {/* Photos */}
      <div style={S.field}>
        <label style={S.label}>Photos / 사진</label>
        <label htmlFor="bm-photos" style={S.uploadBtn}>
          + Add photos
          <input
            id="bm-photos"
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => uploadFiles(e.target.files, 'photo')}
            style={{ display: 'none' }}
          />
        </label>
        {photos.length > 0 && (
          <ul style={S.fileList}>
            {photos.map((p) => (
              <li key={p.url} style={S.fileItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} style={S.thumb} />
                <span style={S.fileName}>{p.name}</span>
                <button
                  type="button"
                  onClick={() => removePhoto(p.url)}
                  style={S.removeBtn}
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documents */}
      <div style={S.field}>
        <label style={S.label}>Documents / 문서</label>
        <label htmlFor="bm-docs" style={S.uploadBtn}>
          + Add documents
          <input
            id="bm-docs"
            type="file"
            multiple
            onChange={(e) => uploadFiles(e.target.files, 'document')}
            style={{ display: 'none' }}
          />
        </label>
        {documents.length > 0 && (
          <ul style={S.fileList}>
            {documents.map((d) => (
              <li key={d.url} style={S.fileItem}>
                <span aria-hidden="true" style={S.docIcon}>📄</span>
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={S.fileName}>
                  {d.name}
                </a>
                <button
                  type="button"
                  onClick={() => removeDocument(d.url)}
                  style={S.removeBtn}
                  aria-label={`Remove ${d.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div role="alert" style={S.errorBox}>
          {error}
        </div>
      )}
      {toast && (
        <div role="status" style={S.toast}>
          {toast}
        </div>
      )}

      <div style={S.actions}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ ...S.btn, ...S.btnGhost }}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || submitting}
          style={{
            ...S.btn,
            ...S.btnPrimary,
            opacity: !valid || submitting ? 0.5 : 1,
            cursor: !valid || submitting ? 'not-allowed' : 'pointer',
          }}
          aria-busy={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit / 신고'}
        </button>
      </div>
    </form>
  );
}

const S: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '0 14px 24px',
    color: '#e2e8f0',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  req: { color: '#fca5a5' },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#1e293b',
    color: '#f1f5f9',
    minHeight: 44,
    fontFamily: 'inherit',
  },
  err: { fontSize: 12, color: '#fca5a5', marginTop: 2 },
  picker: {
    background: '#0b1220',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    maxHeight: 320,
    overflowY: 'auto',
  },
  pickerMsg: { padding: '12px 8px', color: '#64748b', fontSize: 13 },
  pickerList: { listStyle: 'none', margin: 0, padding: 0 },
  pickerItem: {
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    color: '#e2e8f0',
    border: 'none',
    padding: '10px 8px',
    borderBottom: '1px solid #1f2937',
    cursor: 'pointer',
    minHeight: 44,
  },
  pickerCode: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    color: '#f8fafc',
    fontWeight: 700,
  },
  pickerName: { color: '#cbd5e1' },
  pickerLoc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1e293b',
    color: '#93c5fd',
    border: '1px dashed #334155',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
  },
  fileList: { listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#1e293b',
    border: '1px solid #1f2937',
    borderRadius: 8,
    padding: '8px 10px',
  },
  thumb: { width: 36, height: 36, objectFit: 'cover', borderRadius: 6, background: '#0b1220' },
  docIcon: { fontSize: 22 },
  fileName: { flex: 1, fontSize: 13, color: '#cbd5e1', wordBreak: 'break-all' },
  removeBtn: {
    width: 32,
    height: 32,
    background: '#334155',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
  },
  errorBox: {
    padding: 12,
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 8,
    fontSize: 14,
  },
  toast: {
    padding: 12,
    background: 'rgba(34,197,94,0.15)',
    color: '#86efac',
    border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
  },
  btnPrimary: { background: '#dc2626', color: '#fff' },
  btnGhost: { background: '#334155', color: '#e2e8f0' },
};
