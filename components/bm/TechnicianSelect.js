// components/bm/TechnicianSelect.js
// 기술자 선택 드롭다운 — technicians 테이블에서 활성 기술자를 팀별로 그룹화하여 표시.
// 사용처: pages/bm/[id].js (수리 완료 처리 시), pages/bm/edit/[id].js
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const TEAM_LABEL = {
  mechanical: '기계',
  electrical: '전기',
  welding:    '용접',
  general:    '일반',
};

const defaultInputStyle = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(15,23,42,0.6)',
  color: '#e2e8f0',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function TechnicianSelect({
  value,
  onChange,
  disabled = false,
  placeholder = '기술자 선택',
  style,
}) {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, name_ta, team')
        .eq('is_active', true)
        .order('team', { ascending: true })
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setTechs(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // 팀별 그룹화
  const groups = techs.reduce((acc, t) => {
    const g = t.team || 'general';
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});

  const mergedStyle = { ...defaultInputStyle, ...(style || {}) };

  if (error) {
    return (
      <div style={{ ...mergedStyle, color: '#fca5a5', fontSize: 14 }}>
        기술자 목록 로드 실패: {error}
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
      style={mergedStyle}
      aria-label="기술자 선택"
    >
      <option value="">{loading ? '불러오는 중…' : placeholder}</option>
      {Object.entries(groups).map(([team, list]) => (
        <optgroup key={team} label={TEAM_LABEL[team] || team}>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.name_ta ? ` · ${t.name_ta}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
