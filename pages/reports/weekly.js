import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const WEEKS = [1, 2, 3, 4, 5];

export default function WeeklyPage() {
  const { isAuthed } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tasks, setTasks] = useState(WEEKS.map(w => ({ week: w, content: '' })));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadData(); }, [year, month]);

  async function loadData() {
    try {
      const r = await fetch(`/api/reports/${year}/${month}`);
      if (!r.ok) return;
      const json = await r.json();
      const wt = json.report?.weekly_tasks;
      if (Array.isArray(wt) && wt.length > 0) {
        const merged = WEEKS.map(w => {
          const found = wt.find(t => t.week === w);
          return { week: w, content: found?.content || '' };
        });
        setTasks(merged);
      } else {
        setTasks(WEEKS.map(w => ({ week: w, content: '' })));
      }
    } catch {}
  }

  function updateTask(week, content) {
    setTasks(prev => prev.map(t => t.week === week ? { ...t, content } : t));
  }

  async function save() {
    if (!isAuthed) return alert('로그인이 필요합니다');
    setSaving(true); setMsg('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      // upsert 월 먼저
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year, month }),
      });
      const r = await fetch(`/api/reports/${year}/${month}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weekly_tasks: tasks.filter(t => t.content.trim()) }),
      });
      if (!r.ok) throw new Error('저장 실패');
      setMsg('✅ 저장 완료');
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally { setSaving(false); }
  }

  return (
    <>
      <Head><title>주간업무 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <Link href="/reports" style={S.back}>← 경영실적</Link>
            <h1 style={S.h1}>📋 주간업무</h1>
          </div>

          <div style={S.row}>
            <select value={year} onChange={e => { setYear(+e.target.value); }} style={S.sel}>
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => { setMonth(+e.target.value); }} style={S.sel}>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>

          {WEEKS.map(w => (
            <div key={w} style={S.card}>
              <div style={S.weekLabel}>{w}주차</div>
              <textarea
                value={tasks.find(t => t.week === w)?.content || ''}
                onChange={e => updateTask(w, e.target.value)}
                placeholder="주요 업무, 이슈, 계획 입력..."
                rows={4}
                style={S.textarea}
              />
            </div>
          ))}

          <button onClick={save} disabled={saving || !isAuthed} style={S.btn}>
            {saving ? '저장 중…' : '저장'}
          </button>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
        <BottomNav />
      </div>
    </>
  );
}

const S = {
  page: { minHeight:'100vh', background:'#0f172a', color:'#f1f5f9', paddingBottom:80 },
  wrap: { maxWidth:480, margin:'0 auto', padding:'16px 14px 0' },
  header: { marginBottom:16 },
  back: { color:'#94a3b8', textDecoration:'none', fontSize:14 },
  h1: { fontSize:22, fontWeight:800, margin:'6px 0 0' },
  row: { display:'flex', gap:8, marginBottom:14 },
  sel: { flex:1, background:'#1e293b', border:'1px solid #334155', color:'#f1f5f9', borderRadius:8, padding:'8px 10px', fontSize:14 },
  card: { background:'#1e293b', border:'1px solid #334155', borderRadius:12, padding:14, marginBottom:12 },
  weekLabel: { fontSize:14, fontWeight:700, marginBottom:8, color:'#94a3b8' },
  textarea: {
    width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#f1f5f9',
    borderRadius:8, padding:'10px', fontSize:14, resize:'vertical', boxSizing:'border-box',
    fontFamily:'inherit',
  },
  btn: { width:'100%', padding:'13px 14px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:9, fontSize:16, fontWeight:700, minHeight:44, cursor:'pointer', marginBottom:12 },
  msg: { marginTop:8, padding:'10px 12px', background:'#0f2231', borderRadius:9, fontSize:14, color:'#7dd3fc' },
};
