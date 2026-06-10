'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { Fragment, useEffect, useMemo, useState } from 'react';

type MonthShort =
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';

type Row = {
  id: number;
  code: string;
  name: string;
  name_ko: string | null;
  group: string;       // 'R&M' | '부자재' | '전력' | '기타'
  readonly: boolean;
  unit: string;        // 'Rs' | 'KG'
  note: string | null;
  source: string | null;
  total: number;
} & Record<MonthShort, number>;

type ApiResp = {
  ok: boolean;
  success: boolean;
  year: number;
  groups: Record<string, Row[]>;
  summary: {
    total_rs: number;
    r_m_total: number;
    material_total: number;
    power_total: number;
    other_total: number;
    tech_managed_total: number;
  };
  error?: string;
};

const MONTHS: { key: MonthShort; label: string }[] = [
  { key: 'jan', label: 'JAN' }, { key: 'feb', label: 'FEB' },
  { key: 'mar', label: 'MAR' }, { key: 'apr', label: 'APR' },
  { key: 'may', label: 'MAY' }, { key: 'jun', label: 'JUN' },
  { key: 'jul', label: 'JUL' }, { key: 'aug', label: 'AUG' },
  { key: 'sep', label: 'SEP' }, { key: 'oct', label: 'OCT' },
  { key: 'nov', label: 'NOV' }, { key: 'dec', label: 'DEC' },
];

const GROUP_ORDER = ['R&M', '부자재', '전력', '기타'] as const;
const GROUP_LABEL: Record<string, string> = {
  'R&M':   'R&M 유지보수 (1.1~1.7, 7개 · 편집 가능)',
  '부자재': '부자재 (2.1, 3.1~3.5, 6개 · 편집 가능)',
  '전력':   '[제외] 전력 비용 (4.1 · 공장 고정비 · 기술팀 관제 외)',
  '기타':   '[제외] 기타·일일소비량 (4.2 KG, 4.3 Rs · 참고용)',
};
const EXCLUDED_GROUPS = new Set(['전력', '기타']);
const EDITABLE_GROUPS = new Set(['R&M', '부자재']);

function fmt(n: number, unit: string = 'Rs'): string {
  if (!Number.isFinite(n) || n === 0) return '';
  const s = n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return unit === 'KG' ? `${s} KG` : s;
}

function sumRows(rows: Row[], month: MonthShort): number {
  return rows.filter(r => r.unit === 'Rs').reduce((s, r) => s + Number(r[month] || 0), 0);
}

function sumRowsTotal(rows: Row[]): number {
  return rows.filter(r => r.unit === 'Rs').reduce((s, r) => s + r.total, 0);
}

export default function RmPage() {
  const [year, setYear] = useState(2026);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; month: MonthShort } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rm/expenses?year=${year}`, { cache: 'no-store' });
      const j: ApiResp = await res.json();
      if (!j.ok) throw new Error(j.error || 'load failed');
      setData(j);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  const allRows = useMemo<Row[]>(() => {
    if (!data) return [];
    return GROUP_ORDER.flatMap(g => data.groups[g] || []);
  }, [data]);

  const monthlyTotals = useMemo(() => {
    const r: Record<MonthShort, number> = {} as any;
    for (const m of MONTHS) r[m.key] = sumRows(allRows, m.key);
    return r;
  }, [allRows]);

  const monthlyTechTotals = useMemo(() => {
    const r: Record<MonthShort, number> = {} as any;
    const tech = allRows.filter(x => !x.readonly);
    for (const m of MONTHS) r[m.key] = sumRows(tech, m.key);
    return r;
  }, [allRows]);

  async function saveCell(row: Row, month: MonthShort, value: string) {
    if (row.readonly) { setEditing(null); return; }
    setSaving(true);
    try {
      const n = value === '' ? 0 : Number(value.replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) throw new Error('숫자가 아님');
      const res = await fetch('/api/rm/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, month, amount: n }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'save failed');
      // optimistic local update
      setData(prev => {
        if (!prev) return prev;
        const grp = { ...prev.groups };
        for (const g of Object.keys(grp)) {
          grp[g] = grp[g].map(r =>
            r.id === row.id
              ? { ...r, [month]: n, total: r.total - Number(r[month] || 0) + n }
              : r
          );
        }
        return { ...prev, groups: grp };
      });
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || e));
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  function downloadCSV() {
    if (!data) return;
    const header = ['Group', 'Code', 'Category', 'Korean', 'Unit', ...MONTHS.map(m => m.label), 'Total', 'ReadOnly', 'Note'];
    const lines = [header.join(',')];
    for (const g of GROUP_ORDER) {
      for (const r of (data.groups[g] || [])) {
        const cells = [
          `"${g}"`,
          r.code,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${(r.name_ko || '').replace(/"/g, '""')}"`,
          r.unit,
          ...MONTHS.map(m => String(Number(r[m.key] || 0))),
          String(r.total),
          r.readonly ? 'YES' : 'NO',
          `"${(r.note || '').replace(/"/g, '""')}"`,
        ];
        lines.push(cells.join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rm_expenses_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-[1500px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              R&amp;M Monthly Cost — 기술팀 관제 13개 카테고리 + 제외 항목
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              편집 13개 (R&amp;M 7 + 부자재 6) · 제외 항목은 별도 표시 (전력비·일일소비량·기타). 셀 클릭 → 입력 → Enter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border rounded px-3 py-2 text-base bg-white"
            >
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={downloadCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded mb-3 text-sm">
            오류: {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
              <SummaryCard label="R&M 7개 (1.1~1.7)"      value={data.summary.r_m_total} tone="blue" />
              <SummaryCard label="부자재 6개 (2.1, 3.1~3.5)" value={data.summary.material_total} tone="indigo" />
              <SummaryCard label="[제외] 전력 (4.1)"         value={data.summary.power_total} tone="gray" />
              <SummaryCard label="[제외] 기타 (4.2/4.3)"     value={data.summary.other_total} tone="gray" />
              <SummaryCard
                label="기술팀 관제 13개 합계 (편집)"
                value={data.summary.tech_managed_total}
                tone="green"
                emph
                sub={(() => {
                  const denom = data.summary.tech_managed_total + data.summary.power_total + data.summary.other_total;
                  if (!denom) return '';
                  const pct = (data.summary.tech_managed_total / denom) * 100;
                  return `전체 대비 ${pct.toFixed(1)}%`;
                })()}
              />
            </div>
            <div className="text-[11px] sm:text-xs text-gray-500 mb-3 leading-relaxed">
              제외 항목 4건: <b>4.1 전력비</b> (공장 고정비), <b>4.2 일일 부자재 소비</b> (KG 운영지표), <b>4.3 기타 비용</b> (디젤·STP 인력 등), 그리고 <b>Tally 원본 / 분석 대시보드</b>는 별도 모듈에서 관리.
            </div>
          </>
        )}

        <div className="bg-white border border-gray-300 rounded overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left min-w-[260px] sticky left-0 bg-gray-100 z-10">
                  Code / Category
                </th>
                {MONTHS.map(m => (
                  <th key={m.key} className="border border-gray-300 px-2 py-2 text-right min-w-[90px]">
                    {m.label}
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2 text-right min-w-[110px] bg-yellow-50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={MONTHS.length + 2} className="text-center py-6 text-gray-400">로딩 중...</td></tr>
              )}
              {!loading && data && GROUP_ORDER.map((group, idx) => {
                const rows = data.groups[group] || [];
                if (rows.length === 0) return null;
                const groupReadOnly = rows.every(r => r.readonly);
                const prevGroup = idx > 0 ? GROUP_ORDER[idx - 1] : null;
                const showExcludedDivider =
                  EXCLUDED_GROUPS.has(group) && (!prevGroup || EDITABLE_GROUPS.has(prevGroup));
                return (
                  <Fragment key={group}>
                    {showExcludedDivider && (
                      <tr className="bg-gray-300 font-bold text-gray-800">
                        <td colSpan={MONTHS.length + 2} className="border border-gray-400 px-2 py-2 sticky left-0 bg-gray-300 text-sm">
                          ═══ 제외 항목 (Excluded — 참고용·읽기 전용) ═══
                        </td>
                      </tr>
                    )}
                    <GroupBlock
                      group={group}
                      rows={rows}
                      readOnly={groupReadOnly}
                      editing={editing}
                      setEditing={setEditing}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      saveCell={saveCell}
                    />
                  </Fragment>
                );
              })}

              {!loading && data && (
                <>
                  <tr className="bg-blue-50 font-bold">
                    <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-blue-50">
                      기술팀 관제 13개 월별 합계 (Rs)
                    </td>
                    {MONTHS.map(m => (
                      <td key={m.key} className="border border-gray-300 px-2 py-2 text-right">
                        {fmt(monthlyTechTotals[m.key])}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-2 py-2 text-right bg-blue-100">
                      {fmt(data.summary.tech_managed_total)}
                    </td>
                  </tr>
                  <tr className="bg-gray-200 font-bold">
                    <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-gray-200">
                      전체 월별 합계 (Rs, 전력·기타 포함)
                    </td>
                    {MONTHS.map(m => (
                      <td key={m.key} className="border border-gray-300 px-2 py-2 text-right">
                        {fmt(monthlyTotals[m.key])}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-2 py-2 text-right bg-yellow-100">
                      {fmt(data.summary.total_rs)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500 leading-relaxed">
          {saving ? <span className="text-blue-600">저장 중...</span> :
            <span>셀 클릭 → 숫자 입력 → Enter 저장. 회색 행(전력 4.1 / 기타 4.2·4.3)은 편집 불가.</span>}
          <br/>
          데이터 출처: TALLY DOWNLOAD (2026 1~4월 실적), 5월 이후 각 팀 직접 입력. 단위 Rs (단, 4.2 일일소비량은 KG).
        </div>
      </div>
    </div>
  );
}

/* ───────── components ───────── */

function SummaryCard({ label, value, tone, emph, sub }: { label: string; value: number; tone: 'blue'|'indigo'|'gray'|'green'; emph?: boolean; sub?: string }) {
  const bg = {
    blue:   'bg-blue-50   border-blue-200   text-blue-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    gray:   'bg-gray-100  border-gray-300   text-gray-700',
    green:  'bg-green-50  border-green-300  text-green-900',
  }[tone];
  return (
    <div className={`border rounded p-2 ${bg} ${emph ? 'ring-2 ring-green-400' : ''}`}>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
      <div className="text-sm sm:text-base font-bold tabular-nums">
        Rs {value.toLocaleString('en-IN')}
      </div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function GroupBlock({
  group, rows, readOnly,
  editing, setEditing, editValue, setEditValue, saveCell,
}: {
  group: string;
  rows: Row[];
  readOnly: boolean;
  editing: { id: number; month: MonthShort } | null;
  setEditing: (v: any) => void;
  editValue: string;
  setEditValue: (v: string) => void;
  saveCell: (row: Row, month: MonthShort, value: string) => void;
}) {
  const groupBg = readOnly ? 'bg-gray-100' : 'bg-blue-50';
  const subtotalBg = readOnly ? 'bg-gray-200' : 'bg-blue-100';

  // group subtotal per month (Rs only)
  const monthSub = (m: MonthShort) =>
    rows.filter(r => r.unit === 'Rs').reduce((s, r) => s + Number(r[m] || 0), 0);
  const groupSubTotal = rows.filter(r => r.unit === 'Rs').reduce((s, r) => s + r.total, 0);

  return (
    <>
      <tr className={`${groupBg} font-semibold`}>
        <td colSpan={MONTHS.length + 2} className={`border border-gray-300 px-2 py-1 sticky left-0 ${groupBg}`}>
          ▸ {GROUP_LABEL[group] || group}
        </td>
      </tr>
      {rows.map(r => (
        <tr key={r.id} className={r.readonly ? 'bg-gray-50 text-gray-600' : 'hover:bg-yellow-50'}>
          <td className={`border border-gray-300 px-2 py-1 sticky left-0 ${r.readonly ? 'bg-gray-50' : 'bg-white hover:bg-yellow-50'}`}>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono text-gray-500">{r.code}</span>
              <span className="font-medium text-gray-900">{r.name}</span>
              {r.readonly && <span className="text-[10px] text-gray-500 ml-1">🔒</span>}
            </div>
            {r.name_ko && <div className="text-[11px] text-gray-500">{r.name_ko}</div>}
            {r.note && <div className="text-[10px] text-gray-400 italic">{r.note}</div>}
          </td>
          {MONTHS.map(m => {
            const isEd = !r.readonly && editing?.id === r.id && editing?.month === m.key;
            const val = Number(r[m.key] || 0);
            return (
              <td
                key={m.key}
                className={`border border-gray-300 px-1 py-0 text-right ${r.readonly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (r.readonly) return;
                  if (!isEd) {
                    setEditing({ id: r.id, month: m.key });
                    setEditValue(val === 0 ? '' : String(val));
                  }
                }}
              >
                {isEd ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => saveCell(r, m.key, editValue)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCell(r, m.key, editValue);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="w-full text-right border-0 outline-none bg-yellow-100 px-1 py-1 text-sm"
                    inputMode="numeric"
                  />
                ) : (
                  <span className="block px-1 py-1 tabular-nums">{fmt(val, r.unit)}</span>
                )}
              </td>
            );
          })}
          <td className="border border-gray-300 px-2 py-1 text-right font-semibold bg-yellow-50 tabular-nums">
            {fmt(r.total, r.unit)}
          </td>
        </tr>
      ))}
      <tr className={`${subtotalBg} font-semibold text-xs`}>
        <td className={`border border-gray-300 px-2 py-1 sticky left-0 ${subtotalBg}`}>
          └ {group} 소계 (Rs)
        </td>
        {MONTHS.map(m => (
          <td key={m.key} className="border border-gray-300 px-2 py-1 text-right tabular-nums">
            {fmt(monthSub(m.key))}
          </td>
        ))}
        <td className="border border-gray-300 px-2 py-1 text-right bg-yellow-100 tabular-nums">
          {fmt(groupSubTotal)}
        </td>
      </tr>
    </>
  );
}
