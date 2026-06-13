// components/bm/TechnicianSelect.js
// 보전 담당자 드롭다운 — team 기준 그룹핑 (mechanical / electrical / general / welding)
//
// Props:
//   value       : selected technician_id (uuid)
//   onChange    : (technicianId | null) => void
//   disabled    : boolean
//   placeholder : (optional) — default '— 담당자 선택 —'
//   includeName : (optional) — pass true if you want onChange(id, technicianRecord)
//
// Loads active technicians via the public/anon supabase client.
// Renders <optgroup> per team.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const TEAM_LABELS = {
  mechanical: '기계 (Mechanical)',
  electrical: '전기 (Electrical)',
  welding:    '용접 (Welding)',
  general:    '일반 (General)',
};
const TEAM_ORDER = ['mechanical', 'electrical', 'welding', 'general'];

export default function TechnicianSelect({
  value,
  onChange,
  disabled = false,
  placeholder = '— 담당자 선택 —',
  includeName = false,
  style: extraStyle,
}) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('technicians')
          .select('id, name, name_ta, team')
          .eq('is_active', true)
          .order('team', { ascending: true })
          .order('name', { ascending: true });
        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
          setTechnicians([]);
        } else {
          setTechnicians(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setTechnicians([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Group by team in defined order; any unknown team falls under "general"
  const grouped = TEAM_ORDER.reduce((acc, team) => {
    acc[team] = [];
    return acc;
  }, {});
  for (const t of technicians) {
    const team = grouped[t.team] ? t.team : 'general';
    grouped[team].push(t);
  }

  function handleChange(e) {
    const id = e.target.value || null;
    if (includeName) {
      const rec = technicians.find(t => t.id === id) || null;
      onChange?.(id, rec);
    } else {
      onChange?.(id);
    }
  }

  if (error) {
    return (
      <div style={{ ...S.errorBox, ...extraStyle }}>
        담당자 목록을 불러오지 못했습니다: {error}
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || loading}
      style={{ ...S.select, ...extraStyle }}
      aria-label="담당자 선택"
    >
      <option value="">
        {loading ? '담당자 목록 로딩 중…' : placeholder}
      </option>
      {!loading && TEAM_ORDER.map(team => {
        const list = grouped[team];
        if (!list || list.length === 0) return null;
        return (
          <optgroup key={team} label={TEAM_LABELS[team] || team}>
            {list.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.name_ta ? ` · ${t.name_ta}` : ''}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

const S = {
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 16,        // ≥16px to prevent iOS zoom
    outline: 'none',
    boxSizing: 'border-box',
    background: '#0b1220',
    color: '#f1f5f9',
    fontFamily: 'inherit',
    minHeight: 44,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    cursor: 'pointer',
  },
  errorBox: {
    width: '100%',
    padding: '12px',
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box',
  },
};
