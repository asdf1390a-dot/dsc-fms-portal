// Team Dashboard P2 — Portfolio management page
// Lists portfolio_items with status filter, supports create/edit/delete via modal.
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
  { value: 'in_progress', label: '진행중' },
  { value: 'completed',   label: '완료' },
  { value: 'on_hold',     label: '보류' },
  { value: 'planned',     label: '계획' },
];

const STATUS_LABEL = {
  in_progress: '진행중',
  completed:   '완료',
  on_hold:     '보류',
  planned:     '계획',
};

const STATUS_COLOR = {
  in_progress: { bg: 'rgba(59,130,246,0.2)',  fg: '#93c5fd' },
  completed:   { bg: 'rgba(16,185,129,0.2)',  fg: '#6ee7b7' },
  on_hold:     { bg: 'rgba(245,158,11,0.2)',  fg: '#fcd34d' },
  planned:     { bg: 'rgba(148,163,184,0.2)', fg: '#cbd5e1' },
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PortfolioPage() {
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
      router.replace(`/login?next=${encodeURIComponent('/dashboard/portfolio')}`);
    }
  }, [authLoading, isAuthed, router]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
      const r = await fetch(`/api/dashboard/portfolio${qs}`, { headers: await authHeader() });
      const j = await r.json().catch(() => ({}));
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
    if (!confirm('이 포트폴리오를 삭제하시겠습니까?')) return;
    try {
      const r = await fetch(`/api/dashboard/portfolio/${id}`, {
        method: 'DELETE', headers: await authHeader(),
      });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      load();
    } catch (e) {
      alert(e.message || String(e));
    }
  }, [load]);

  return (
    <>
      <Head>
        <title>포트폴리오 | Team Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href="/dashboard/milestones" style={C.backLink}>마일스톤</Link>
          <h1 style={C.title}>포트폴리오</h1>
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
            <div style={C.empty}>포트폴리오가 없습니다. 우상단 [+ 추가]를 눌러 등록하세요.</div>
          ) : (
            items.map(it => (
              <PortfolioCard
                key={it.id}
                item={it}
                isOwner={userId === it.member_id}
                onEdit={() => { setEditing(it); setShowForm(true); }}
                onDelete={() => handleDelete(it.id)}
              />
            ))
          )}
        </div>

        {showForm && (
          <PortfolioFormModal
            initial={editing}
            onClose={() => { setShowForm(false); setEditing(null); }}
            onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          />
        )}
      </main>
      <BottomNav />
    </>
  );
}

function PortfolioCard({ item, isOwner, onEdit, onDelete }) {
  const col = STATUS_COLOR[item.status] || STATUS_COLOR.planned;
  const period = [item.start_date, item.end_date].filter(Boolean).join(' ~ ') || '기간 미지정';
  return (
    <div style={C.card}>
      <div style={S.cardHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.projectName}>{item.project_name}</div>
          {item.role && <div style={S.roleText}>{item.role}</div>}
        </div>
        <span style={{ ...C.badge, background: col.bg, color: col.fg }}>
          {STATUS_LABEL[item.status] || item.status}
        </span>
      </div>
      <div style={S.metaText}>{period}</div>
      {item.description && <div style={S.descText}>{item.description}</div>}
      {Array.isArray(item.skills_used) && item.skills_used.length > 0 && (
        <div style={S.skillRow}>
          {item.skills_used.map((s, i) => (
            <span key={`${s}-${i}`} style={S.skillChip}>{s}</span>
          ))}
        </div>
      )}
      {isOwner && (
        <div style={S.actionRow}>
          <button type="button" onClick={onEdit} style={C.secondaryBtn}>편집</button>
          <button type="button" onClick={onDelete} style={C.dangerBtn}>삭제</button>
        </div>
      )}
    </div>
  );
}

function PortfolioFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [projectName, setProjectName] = useState(initial?.project_name || '');
  const [role, setRole]               = useState(initial?.role || '');
  const [startDate, setStartDate]     = useState(initial?.start_date || '');
  const [endDate, setEndDate]         = useState(initial?.end_date || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [skillsText, setSkillsText]   = useState(
    Array.isArray(initial?.skills_used) ? initial.skills_used.join(', ') : ''
  );
  const [statusVal, setStatusVal]     = useState(initial?.status || 'in_progress');
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) { setErr('프로젝트명을 입력하세요.'); return; }
    setSaving(true); setErr(null);
    try {
      const skills_used = skillsText
        .split(',').map(s => s.trim()).filter(Boolean);
      const body = {
        project_name: projectName.trim(),
        role:         role.trim() || null,
        start_date:   startDate || null,
        end_date:     endDate   || null,
        description:  description.trim() || null,
        skills_used:  skills_used.length ? skills_used : null,
        status:       statusVal,
      };
      const url    = isEdit ? `/api/dashboard/portfolio/${initial.id}` : '/api/dashboard/portfolio';
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
          <h2 style={S.modalTitle}>{isEdit ? '포트폴리오 편집' : '포트폴리오 추가'}</h2>
          <button type="button" onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <form onSubmit={submit}>
          <label style={C.field}>
            <span style={C.fieldLabel}>프로젝트명 *</span>
            <input style={C.input} value={projectName}
                   onChange={e => setProjectName(e.target.value)} required />
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>역할</span>
            <input style={C.input} value={role}
                   onChange={e => setRole(e.target.value)} placeholder="예: PM, Lead Dev" />
          </label>
          <div style={S.row2}>
            <label style={{ ...C.field, flex: 1 }}>
              <span style={C.fieldLabel}>시작일</span>
              <input type="date" style={C.input} value={startDate}
                     onChange={e => setStartDate(e.target.value)} />
            </label>
            <label style={{ ...C.field, flex: 1 }}>
              <span style={C.fieldLabel}>종료일</span>
              <input type="date" style={C.input} value={endDate}
                     onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>
          <label style={C.field}>
            <span style={C.fieldLabel}>상태</span>
            <select style={C.input} value={statusVal}
                    onChange={e => setStatusVal(e.target.value)}>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
              <option value="on_hold">보류</option>
              <option value="planned">계획</option>
            </select>
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>설명</span>
            <textarea style={C.textarea} value={description} rows={3}
                      onChange={e => setDescription(e.target.value)} />
          </label>
          <label style={C.field}>
            <span style={C.fieldLabel}>스킬 (쉼표로 구분)</span>
            <input style={C.input} value={skillsText}
                   onChange={e => setSkillsText(e.target.value)}
                   placeholder="예: React, Supabase, PostgreSQL" />
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

  cardHead: {
    display: 'flex', alignItems: 'flex-start',
    gap: 10, marginBottom: 6,
  },
  projectName: {
    fontSize: 15, fontWeight: 700, color: '#f8fafc',
    overflow: 'hidden', textOverflow: 'ellipsis',
  },
  roleText: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  metaText: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  descText: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 },
  skillRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  skillChip: {
    padding: '3px 8px', fontSize: 11, fontWeight: 600,
    background: 'rgba(99,102,241,0.18)', color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.35)', borderRadius: 6,
  },
  actionRow: { display: 'flex', gap: 8, marginTop: 4 },

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
  row2: { display: 'flex', gap: 8 },
};
