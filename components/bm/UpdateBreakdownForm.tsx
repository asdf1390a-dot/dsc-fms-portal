// components/bm/UpdateBreakdownForm.tsx
// BM-P1 Phase 2 M3.4 — Update Breakdown Form.
// Status transitions enforced client-side via VALID_STATUS_TRANSITIONS.

import { useEffect, useMemo, useState } from 'react';
import {
  BreakdownCategory,
  BreakdownReport,
  BreakdownSeverity,
  BreakdownStatus,
  updateBreakdown,
  VALID_STATUS_TRANSITIONS,
} from '../../lib/hooks/useBreakdowns';
import { supabase } from '../../lib/supabase';

const SEVERITY_OPTIONS: { value: BreakdownSeverity; label: string }[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'normal', label: 'Normal' },
  { value: 'major', label: 'Major' },
  { value: 'line_down', label: 'Line Down' },
];

const CATEGORY_OPTIONS: { value: BreakdownCategory; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'software', label: 'Software' },
  { value: 'operator_error', label: 'Operator Error' },
  { value: 'unknown', label: 'Unknown' },
];

const STATUS_LABELS: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  won_fix: "Won't Fix",
};

interface UploadedFile {
  url: string;
  name: string;
}

interface UserOption {
  id: string;
  label: string;
}

interface Props {
  breakdown: BreakdownReport;
  isAdmin?: boolean;
  onSuccess?: (updated: BreakdownReport) => void;
  onCancel?: () => void;
}

export default function UpdateBreakdownForm({
  breakdown,
  isAdmin = false,
  onSuccess,
  onCancel,
}: Props) {
  const validNextStatuses = VALID_STATUS_TRANSITIONS[breakdown.status] || [];
  const statusOptions: BreakdownStatus[] = [breakdown.status, ...validNextStatuses];

  const [status, setStatus] = useState<BreakdownStatus>(breakdown.status);
  const [severity, setSeverity] = useState<BreakdownSeverity>(breakdown.severity);
  const [category, setCategory] = useState<BreakdownCategory | ''>(
    (breakdown.category as BreakdownCategory) || ''
  );
  const [assignedTo, setAssignedTo] = useState<string>(breakdown.assigned_to || '');
  const [resolvedAt, setResolvedAt] = useState<string>(
    breakdown.resolved_at ? toLocalInput(breakdown.resolved_at) : ''
  );
  const [rootCause, setRootCause] = useState<string>(breakdown.root_cause || '');
  const [actionTaken, setActionTaken] = useState<string>(breakdown.action_taken || '');
  const [newPhotos, setNewPhotos] = useState<UploadedFile[]>([]);
  const [newDocuments, setNewDocuments] = useState<UploadedFile[]>([]);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users list for assignment picker (admin only).
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        // Try team_members table (used elsewhere in repo).
        const { data } = await supabase
          .from('team_members')
          .select('id, full_name, employee_id')
          .order('full_name', { ascending: true })
          .limit(200);
        const opts = (data || []).map((u: any) => ({
          id: u.id,
          label: `${u.full_name || u.employee_id}${u.employee_id ? ` (${u.employee_id})` : ''}`,
        }));
        setUsers(opts);
      } catch {
        setUsers([]);
      }
    })();
  }, [isAdmin]);

  // Auto-set resolvedAt when status transitions to resolved.
  useEffect(() => {
    if (status === 'resolved' && !resolvedAt) {
      setResolvedAt(toLocalInput(new Date().toISOString()));
    }
  }, [status, resolvedAt]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (status === 'resolved' && !resolvedAt) {
      e.resolvedAt = 'Resolved at is required when status = resolved';
    }
    return e;
  }, [status, resolvedAt]);
  const valid = Object.keys(errors).length === 0;

  async function uploadFiles(files: FileList | null, kind: 'photo' | 'document') {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error('Not signed in');
      const uploaded: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (kind === 'photo' && !/^image\//.test(file.type)) {
          setError(`Skipped non-image: ${file.name}`);
          continue;
        }
        const filename = `breakdowns/${breakdown.id}/${Date.now()}-${i}-${file.name.replace(
          /[^\w.\-]/g,
          '_'
        )}`;
        const { error: upErr } = await supabase.storage
          .from('asset-photos')
          .upload(filename, file, { upsert: false, contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from('asset-photos').getPublicUrl(filename);
        uploaded.push({ url: pub.publicUrl, name: file.name });
      }
      if (kind === 'photo') setNewPhotos((prev) => [...prev, ...uploaded]);
      else setNewDocuments((prev) => [...prev, ...uploaded]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!valid) {
      setError('Please fix the highlighted fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const mergedPhotos = [
        ...(breakdown.photos || []),
        ...newPhotos.map((p) => p.url),
      ];
      const mergedDocs = [
        ...(breakdown.documents || []),
        ...newDocuments.map((d) => d.url),
      ];

      const payload: Record<string, unknown> = {};
      if (status !== breakdown.status) payload.status = status;
      if (severity !== breakdown.severity) payload.severity = severity;
      if ((category || null) !== (breakdown.category || null)) {
        payload.category = category || null;
      }
      if (isAdmin && (assignedTo || null) !== (breakdown.assigned_to || null)) {
        payload.assigned_to = assignedTo || null;
      }
      if (resolvedAt) payload.resolved_at = new Date(resolvedAt).toISOString();
      if (rootCause !== (breakdown.root_cause || '')) payload.root_cause = rootCause || null;
      if (actionTaken !== (breakdown.action_taken || '')) {
        payload.action_taken = actionTaken || null;
      }
      if (newPhotos.length > 0) payload.photos = mergedPhotos;
      if (newDocuments.length > 0) payload.documents = mergedDocs;

      const updated = await updateBreakdown(breakdown.id, payload);
      if (onSuccess) onSuccess(updated);
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={S.form} noValidate>
      {/* Status */}
      <div style={S.field}>
        <label htmlFor="upd-status" style={S.label}>
          Status / 상태
        </label>
        <select
          id="upd-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as BreakdownStatus)}
          style={S.input}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
              {s === breakdown.status ? ' (current)' : ''}
            </option>
          ))}
        </select>
        {validNextStatuses.length === 0 && (
          <div style={S.hint}>This breakdown is final — status cannot change further.</div>
        )}
      </div>

      {/* Severity */}
      <div style={S.field}>
        <label htmlFor="upd-sev" style={S.label}>
          Severity
        </label>
        <select
          id="upd-sev"
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
        <label htmlFor="upd-cat" style={S.label}>
          Category
        </label>
        <select
          id="upd-cat"
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

      {/* Assigned to (admin only) */}
      {isAdmin && (
        <div style={S.field}>
          <label htmlFor="upd-assign" style={S.label}>
            Assigned to / 담당자 (admin)
          </label>
          <select
            id="upd-assign"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            style={S.input}
          >
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Resolved at */}
      <div style={S.field}>
        <label htmlFor="upd-resolved" style={S.label}>
          Resolved at {status === 'resolved' && <span style={S.req}>*</span>}
        </label>
        <input
          id="upd-resolved"
          type="datetime-local"
          value={resolvedAt}
          onChange={(e) => setResolvedAt(e.target.value)}
          style={S.input}
          aria-invalid={!!errors.resolvedAt}
        />
        {errors.resolvedAt && <div style={S.err}>{errors.resolvedAt}</div>}
      </div>

      {/* Root cause */}
      <div style={S.field}>
        <label htmlFor="upd-rc" style={S.label}>
          Root cause / 근본 원인
        </label>
        <textarea
          id="upd-rc"
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={3}
          style={{ ...S.input, fontFamily: 'inherit', minHeight: 80 }}
          placeholder="Why did this happen?"
        />
      </div>

      {/* Action taken */}
      <div style={S.field}>
        <label htmlFor="upd-act" style={S.label}>
          Action taken / 조치 내용
        </label>
        <textarea
          id="upd-act"
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          rows={3}
          style={{ ...S.input, fontFamily: 'inherit', minHeight: 80 }}
          placeholder="What was done to fix it?"
        />
      </div>

      {/* Add photos */}
      <div style={S.field}>
        <label style={S.label}>Add photos / 사진 추가</label>
        <label htmlFor="upd-photos" style={S.uploadBtn}>
          + Add photos
          <input
            id="upd-photos"
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => uploadFiles(e.target.files, 'photo')}
            style={{ display: 'none' }}
          />
        </label>
        {newPhotos.length > 0 && (
          <ul style={S.fileList}>
            {newPhotos.map((p) => (
              <li key={p.url} style={S.fileItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} style={S.thumb} />
                <span style={S.fileName}>{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add documents */}
      <div style={S.field}>
        <label style={S.label}>Add documents / 문서 추가</label>
        <label htmlFor="upd-docs" style={S.uploadBtn}>
          + Add documents
          <input
            id="upd-docs"
            type="file"
            multiple
            onChange={(e) => uploadFiles(e.target.files, 'document')}
            style={{ display: 'none' }}
          />
        </label>
        {newDocuments.length > 0 && (
          <ul style={S.fileList}>
            {newDocuments.map((d) => (
              <li key={d.url} style={S.fileItem}>
                <span aria-hidden="true" style={S.docIcon}>📄</span>
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={S.fileName}>
                  {d.name}
                </a>
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
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const S: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 14, padding: '0 14px 24px', color: '#e2e8f0' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase' },
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
  hint: { fontSize: 11, color: '#64748b', marginTop: 2 },
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
  errorBox: {
    padding: 12,
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 8,
    fontSize: 14,
  },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  btn: { flex: 1, padding: '14px', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
  btnPrimary: { background: '#2563eb', color: '#fff' },
  btnGhost: { background: '#334155', color: '#e2e8f0' },
};
