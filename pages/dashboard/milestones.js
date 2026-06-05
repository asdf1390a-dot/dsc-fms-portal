// Team Dashboard P2 — Milestones management page
// Table view with status filter, supports create/edit/complete/delete.
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import { C } from '../../components/career/careerStyles';

const STATUS_FILTERS = [
  { value: 'all',         label: '전체' },
  { value: 'pending',     label: '대기' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed',   label: '완료' },
  { value: 'blocked',     label: '차단' },
];

const STATUS_LABEL = {
  pending:     '대기',
  in_progress: '진행중',
  completed:   '완료',
  blocked:     '차단',
};

const STATUS_COLOR = {
  pending:     { bg: 'rgba(148,163,184,0.2)', fg: '#cbd5e1' },
  in_progress: { bg: 'rgba(59,130,246,0.2)',  fg: '#93c5fd' },
  completed:   { bg: 'rgba(16,185,129,0.2)',  fg: '#6ee7b7' },
  blocked:     { bg: 'rgba(220,38,38,0.2)',   fg: '#fca5a5' },
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isOverdue(target, status) {
  if (!target || status === 'completed') return false;
  return new Date(target) < new Date(new Date().toDateString());
}

export default function MilestonesPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading, user } = useAuth();
  const userId = user?.id || null;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [status, setStatus]   = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/dashboard/milestones')}`);
    }
  }, [authLoading, isAuthed, router]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
      const r  = await fetch(`/api/dashboard/milestones${qs}`, { headers: await authHeader() });
      const j  = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setItems(j.items || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { if (isAuthed) load(); }, [isAuthed, load]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('이 마일스톤을 삭제하시겠습니까?')) return;
    try {
      const r = await fetch(`/api/dashboard/milestones/${id}`, {
        method: 'DELETE', headers: await authHeader(),
      });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      load();
    } catch (e) { alert(e.message || String(e)); }
  }, [load]);

  const handleComplete = useCallback(async (id) => {
    try {
      const r = await fetch(`/api/dashboard/milestones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ status: 'completed' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      load();
    } catch (e) { alert(e.message || String(e)); }
  }, [load]);

  return (
    <>
      <Head>
        <title>마일스톤 | Team Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href="/dashboard/portfolio" style={C.backLink}>포트폴리오</Link>
          <h1 style={C.title}>마일스톤</h1>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ ...C.ghostBtn, color: '#f8fafc', borderColor: '#475569' }}
          >+ 추가</button>
        </header>

        <div style={C.body}>
          <div style={S.filterRow}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                style={{
                  ...S.filterChip,
                  ...(status === f.value ? S.filterChipActive : null),
                }}
              >{f.label}</button>
            ))}
          </div>

          {error && <div style={C.errorBox}>{error}</div>}

          {loading ? (
            <div style={C.loading}>로딩중…</div>
          ) : items.length === 0 ? (
            <div style={C.empty}>마일스톤이 없습니다. 우상단 [+ 추가]를 눌러 등록하세요.</div>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>제목</th>
                    <th style={{ ...S.th, width: 92 }}>목표일</th>
                    <th style={{ ...S.th, width: 70 }}>상태</th>
                    <th style={{ ...S.th, width: 110 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(m => {
                    const col = STATUS_COLOR[m.status] || STATUS_COLOR.pending;
                    const overdue = isOverdue(m.target_date, m.status);
                    const isOwner = userId && m.owner_id === userId;
                    return (
                      <tr key={m.id} style={S.tr}>
                        <td style={S.td}>
                          <div style={S.titleText}>{m.title}</div>
                          {m.owner_id && (
                            <div style={S.ownerText} title={m.owner_id}>
                              owner: {String(m.owner_id).slice(0, 8)}…
                            </div>
                          )}
                        </td>
                        <td style={{ ...S.td, color: overdue ? '#fca5a5' : '#cbd5e1' }}>
                          {m.target_date || '-'}
                          {overdue && <div style={S.overdueLabel}>지연</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ ...C.badge, background: col.bg, color: col.fg }}>
                            {STATUS_LABEL[m.status] || m.status}
                          </span>
                        </td>
                        <td style={S.td}>
                          {isOwner ? (
                            <div style={S.actionStack}>
                              <button type="button" onClick={() => { setEditing(m); setShowForm(true); }}
                                      style={S.miniBtn}>편집</button>
                              {m.status !== 'completed' && (
                                <button type="button" onClick={() => handleComplete(m.id)}
                                        style={{ ...S.miniBtn, ...S.miniBtnOk }}>완료</button>
                              )}
                              <button type="button" onClick={() => handleDelete(m.id)}
                                      style={{ ...S.miniBtn, ...S.miniBtnDanger }}>삭제</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748b' }}>읽기전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showForm && (
          <MilestoneFormModal
            initial={editing}
            defaultOwner={userId}
            onClose={() => { setShowForm(false); setEditing(null); }}
            onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          />
        )}
      </main>
      <BottomNav />
    </>
  );
}

function MilestoneFormModal({ initial, defaultOwner, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [title, setTitle]           = useState(initial?.title || '');
  const [projectId, setProjectId]   = useState(initial?.project_id || '');
  const [targetDate, setTargetDate] = useState(initial?.target_date || '');
  const [statusVal, setStatusVal]   = useState(initial?.status || 'pending');
  const [ownerId, setOwnerId]       = useState(initial?.owner_id || defaultOwner || '');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim())  { setErr('제목을 입력하세요.'); return; }
    if (!targetDate)    { setErr('목표일을 선택하세요.'); return; }
    setSaving(true); setErr(null);
    try {
      const body = {
        title:       title.trim(),
        project_id:  projectId.trim() || null,
        target_date: targetDate,
        status:      statusVal,
        owner_id:    ownerId.trim() || null,
      };
      const url    = isEdit ? `/api/dashboard/milestones/${initial.id}` : '/api/dashboard/milestones';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.modalTitle}>{isEdit ? '마일스톤 편집' : '마일스톤 추가'}</h2>
          <button type="button" onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <form onSubmit={submit}>
          <label style={C.field}>
            <span style={C.fieldLabel}>제목 *</span>
            <input style={C.input} value={title}
                   onChange={e => setTitle(e.target.value)} required />
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>프로젝트 ID (선택)</span>
            <input style={C.input} value={projectId}
                   onChange={e => setProjectId(e.target.value)}
                   placeholder="UUID (portfolio_items.id)" />
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>목표일 *</span>
            <input type="date" style={C.input} value={targetDate}
                   onChange={e => setTargetDate(e.target.value)} required />
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>상태</span>
            <select style={C.input} value={statusVal}
                    onChange={e => setStatusVal(e.target.value)}>
              <option value="pending">대기</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="blocked">차단</option>
            </select>
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>소유자 ID</span>
            <input style={C.input} value={ownerId}
                   onChange={e => setOwnerId(e.target.value)}
                   placeholder="auth.user.id (UUID)" />
          </label>

          {err && <div style={C.errorBox}>{err}</div>}

          <button type="submit" disabled={saving}
                  style={{ ...C.primaryBtn, marginTop: 8, opacity: saving ? 0.6 : 1 }}>
            {saving ? '저장중…' : (isEdit ? '저장' : '추가')}
          </button>
          <button type="button" onClick={onClose}
                  style={{ ...C.secondaryBtn, marginTop: 8 }}>취소</button>
        </form>
      </div>
    </div>
  );
}

const S = {
  filterRow: {
    display: 'flex', gap: 6, overflowX: 'auto',
    marginBottom: 12, paddingBottom: 4,
  },
  filterChip: {
    flex: '0 0 auto', padding: '8px 14px',
    background: '#1e293b', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 999,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 36,
  },
  filterChipActive: {
    background: '#ef4444', color: '#fff', borderColor: '#ef4444',
  },

  tableWrap: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, overflow: 'hidden',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: 12, tableLayout: 'fixed',
  },
  th: {
    padding: '10px 8px', textAlign: 'left',
    background: '#0f172a', color: '#94a3b8',
    fontWeight: 600, fontSize: 11, letterSpacing: 0.3,
    borderBottom: '1px solid #334155',
  },
  tr: { borderBottom: '1px solid #334155' },
  td: {
    padding: '10px 8px', verticalAlign: 'top',
    color: '#cbd5e1', fontSize: 12,
    wordBreak: 'break-word',
  },
  titleText: { fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 2 },
  ownerText: { fontSize: 10, color: '#64748b' },
  overdueLabel: {
    display: 'inline-block', marginTop: 4,
    padding: '1px 6px', fontSize: 10, fontWeight: 700,
    background: 'rgba(220,38,38,0.2)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 4,
  },

  actionStack: { display: 'flex', flexDirection: 'column', gap: 4 },
  miniBtn: {
    padding: '6px 8px', fontSize: 11, fontWeight: 600,
    background: '#334155', color: '#e2e8f0',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    minHeight: 30,
  },
  miniBtnOk: { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' },
  miniBtnDanger: { background: 'rgba(220,38,38,0.18)', color: '#fca5a5' },

  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100, padding: 0,
  },
  modalCard: {
    background: '#0f172a', borderTop: '1px solid #334155',
    borderRadius: '16px 16px 0 0', padding: 16,
    width: '100%', maxWidth: 480,
    maxHeight: '90vh', overflowY: 'auto',
    boxSizing: 'border-box',
  },
  modalHead: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' },
  closeBtn: {
    background: 'transparent', color: '#94a3b8',
    border: 'none', fontSize: 20, cursor: 'pointer',
    minWidth: 44, minHeight: 44,
  },
};
