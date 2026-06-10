'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { useEffect, useMemo, useState } from 'react';

type RmRow = {
  id: number;
  year: number;
  category: string;
  item: string;
  sort_order: number;
  january: number; february: number; march: number; april: number;
  may: number; june: number; july: number; august: number;
  september: number; october: number; november: number; december: number;
  remarks: string | null;
  updated_by: string | null;
  updated_at: string;
};

const MONTHS = [
  { key: 'january',   label: 'JAN' },
  { key: 'february',  label: 'FEB' },
  { key: 'march',     label: 'MAR' },
  { key: 'april',     label: 'APR' },
  { key: 'may',       label: 'MAY' },
  { key: 'june',      label: 'JUN' },
  { key: 'july',      label: 'JUL' },
  { key: 'august',    label: 'AUG' },
  { key: 'september', label: 'SEP' },
  { key: 'october',   label: 'OCT' },
  { key: 'november',  label: 'NOV' },
  { key: 'december',  label: 'DEC' },
] as const;

type MonthKey = typeof MONTHS[number]['key'];

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function rowTotal(r: RmRow): number {
  return MONTHS.reduce((sum, m) => sum + Number(r[m.key] || 0), 0);
}

export default function RmPage() {
  const [year, setYear] = useState(2026);
  const [rows, setRows] = useState<RmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; key: MonthKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newItem, setNewItem] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/r-m?year=${year}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'load failed');
      setRows(data.rows || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of MONTHS) totals[m.key] = 0;
    for (const r of rows) for (const m of MONTHS) totals[m.key] += Number(r[m.key] || 0);
    return totals;
  }, [rows]);

  const grandTotal = useMemo(
    () => MONTHS.reduce((s, m) => s + monthlyTotals[m.key], 0),
    [monthlyTotals]
  );

  async function saveCell(id: number, key: MonthKey, value: string) {
    setSaving(true);
    try {
      const n = value === '' ? 0 : Number(value.replace(/,/g, ''));
      if (!Number.isFinite(n)) throw new Error('숫자가 아님');
      const res = await fetch('/api/r-m', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [key]: n }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'save failed');
      setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: n } : r));
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || e));
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  async function addRow() {
    if (!newCategory.trim()) { alert('카테고리는 필수'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/r-m', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          category: newCategory.trim(),
          item: newItem.trim(),
          sort_order: 99,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'add failed');
      setNewCategory(''); setNewItem(''); setShowAdd(false);
      await load();
    } catch (e: any) {
      alert('추가 실패: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function downloadCSV() {
    const header = ['Category', 'Item', ...MONTHS.map(m => m.label), 'Total', 'Remarks'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const cells = [
        `"${r.category.replace(/"/g, '""')}"`,
        `"${(r.item || '').replace(/"/g, '""')}"`,
        ...MONTHS.map(m => String(Number(r[m.key] || 0))),
        String(rowTotal(r)),
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
      ];
      lines.push(cells.join(','));
    }
    const totalsRow = [
      'TOTAL', '',
      ...MONTHS.map(m => String(monthlyTotals[m.key])),
      String(grandTotal), '',
    ];
    lines.push(totalsRow.join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rm_costs_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              R&amp;M Monthly Cost (수리·유지보수 월별 비용)
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              엑셀 시트와 동일한 행=항목 / 열=월 구조. 셀을 클릭해 직접 편집.
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
              onClick={() => setShowAdd(s => !s)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
            >
              + 행 추가
            </button>
            <button
              onClick={downloadCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="bg-white border rounded p-3 mb-3 flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-600">카테고리 *</label>
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="예: 1.6 Plant Maintenance"
                className="border rounded px-2 py-2 text-base w-64"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600">항목 (선택)</label>
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="세부 항목"
                className="border rounded px-2 py-2 text-base w-48"
              />
            </div>
            <button
              onClick={addRow}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
            >
              저장
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm"
            >
              취소
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded mb-3 text-sm">
            오류: {error}
          </div>
        )}

        <div className="bg-white border border-gray-300 rounded overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left min-w-[200px] sticky left-0 bg-gray-100 z-10">
                  Category / 항목
                </th>
                {MONTHS.map(m => (
                  <th key={m.key} className="border border-gray-300 px-2 py-2 text-right min-w-[90px]">
                    {m.label}
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2 text-right min-w-[110px] bg-yellow-50">
                  Total
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left min-w-[140px]">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={MONTHS.length + 3} className="text-center py-6 text-gray-400">로딩 중...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={MONTHS.length + 3} className="text-center py-6 text-gray-400">데이터 없음</td></tr>
              )}
              {!loading && rows.map(r => (
                <tr key={r.id} className="hover:bg-blue-50">
                  <td className="border border-gray-300 px-2 py-1 sticky left-0 bg-white hover:bg-blue-50">
                    <div className="font-medium text-gray-900">{r.category}</div>
                    {r.item && <div className="text-xs text-gray-500">{r.item}</div>}
                  </td>
                  {MONTHS.map(m => {
                    const isEd = editing?.id === r.id && editing?.key === m.key;
                    const val = Number(r[m.key] || 0);
                    return (
                      <td
                        key={m.key}
                        className="border border-gray-300 px-1 py-0 text-right cursor-pointer"
                        onClick={() => {
                          if (!isEd) {
                            setEditing({ id: r.id, key: m.key });
                            setEditValue(val === 0 ? '' : String(val));
                          }
                        }}
                      >
                        {isEd ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveCell(r.id, m.key, editValue)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveCell(r.id, m.key, editValue);
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="w-full text-right border-0 outline-none bg-yellow-50 px-1 py-1 text-sm"
                            inputMode="numeric"
                          />
                        ) : (
                          <span className="block px-1 py-1">{fmt(val)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 px-2 py-1 text-right font-semibold bg-yellow-50">
                    {fmt(rowTotal(r))}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs text-gray-600">
                    {r.remarks || ''}
                  </td>
                </tr>
              ))}
              {!loading && rows.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-gray-100">
                    월별 합계 (Rs)
                  </td>
                  {MONTHS.map(m => (
                    <td key={m.key} className="border border-gray-300 px-2 py-2 text-right">
                      {fmt(monthlyTotals[m.key])}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-2 py-2 text-right bg-yellow-100">
                    {fmt(grandTotal)}
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          {saving && <span className="text-blue-600">저장 중...</span>}
          {!saving && <span>셀 클릭 → 숫자 입력 → Enter (또는 다른 곳 클릭) 으로 저장. 모든 값 단위 Rs.</span>}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          ※ 데이터 출처: 8개 Excel 비용 파일 분석 (Jan-Apr 2026), 5월부터는 각 팀이 직접 입력
        </div>
      </div>
    </div>
  );
}
