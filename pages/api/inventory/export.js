// GET /api/inventory/export → spare_parts 전체를 CSV로 다운로드
import { supabaseAdmin } from '../../../lib/supabase-admin';

const COLUMNS = [
  'part_number', 'name', 'category', 'location',
  'quantity', 'min_quantity', 'unit_price', 'maker', 'specs',
];

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    // 페이지네이션으로 전체 조회 (안전성)
    const all = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('spare_parts')
        .select(COLUMNS.join(','))
        .order('part_number', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const header = COLUMNS.join(',');
    const rows = all.map(r => COLUMNS.map(c => csvEscape(r[c])).join(','));
    // BOM for Excel UTF-8 compatibility
    const body = '﻿' + [header, ...rows].join('\r\n');

    const today = new Date();
    const p = n => String(n).padStart(2, '0');
    const fname = `inventory_${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'export failed' });
  }
}
