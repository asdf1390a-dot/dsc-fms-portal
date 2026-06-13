// lib/reports/monthly-performance.js
// 월간 경영실적 — 공통 헬퍼
//  - CEO/admin 권한 판별
//  - 감사 로그 기록
//  - 트렌드(insights) 산출

import { supabaseAdmin } from '../supabase-admin';

export function isCeoOrAdmin(user) {
  if (!user) return false;
  const role =
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    null;
  return role === 'ceo' || role === 'admin';
}

export async function logAccess({ reportId, user, action, req }) {
  try {
    const ip =
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req?.socket?.remoteAddress ||
      null;
    const ua = req?.headers?.['user-agent'] || null;
    await supabaseAdmin.from('monthly_report_access_logs').insert({
      report_id: reportId || null,
      user_id: user?.id || null,
      user_email: user?.email || null,
      action,
      ip_address: ip,
      user_agent: ua,
    });
  } catch (e) {
    // 감사 로그 실패는 본 흐름을 막지 않는다
    console.error('[mpr] logAccess failed:', e?.message);
  }
}

// 최근 N개월 KPI 추이 → insights 산출
// kpi 형식: { production:{actual_qty,plan_qty,eff,oee}, quality:{customer_ppm,...} ... }
export function buildInsights(currentKpi, history) {
  const pickNum = (o, path) => {
    const parts = path.split('.');
    let v = o;
    for (const p of parts) { v = v?.[p]; if (v == null) return null; }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const fields = [
    { key: 'production.actual_qty', label: '실적수량', better: 'up' },
    { key: 'production.eff',        label: '효율',     better: 'up' },
    { key: 'production.oee',        label: 'OEE',     better: 'up' },
    { key: 'quality.customer_ppm',  label: '고객PPM', better: 'down' },
    { key: 'quality.inprocess_ppm', label: '공정PPM', better: 'down' },
    { key: 'quality.claim_cost',    label: '클레임비용', better: 'down' },
  ];
  const prev = history?.[0]?.kpi || {};
  const sameMonthLastYear = history?.find?.((h) => h._yoy)?.kpi || {};

  const trends = fields.map((f) => {
    const cur = pickNum(currentKpi, f.key);
    const mom = pickNum(prev, f.key);
    const yoy = pickNum(sameMonthLastYear, f.key);
    const momDelta = (cur != null && mom != null) ? cur - mom : null;
    const yoyDelta = (cur != null && yoy != null) ? cur - yoy : null;
    const momPct = (cur != null && mom) ? ((cur - mom) / mom) * 100 : null;
    const yoyPct = (cur != null && yoy) ? ((cur - yoy) / yoy) * 100 : null;
    return { ...f, current: cur, mom, yoy, momDelta, yoyDelta, momPct, yoyPct };
  });

  // 6개월 시계열 (current 포함)
  const series = (history || []).slice(0, 6).reverse().map((h) => ({
    year: h.year, month: h.month,
    production_qty: pickNum(h.kpi, 'production.actual_qty'),
    eff:            pickNum(h.kpi, 'production.eff'),
    oee:            pickNum(h.kpi, 'production.oee'),
    customer_ppm:   pickNum(h.kpi, 'quality.customer_ppm'),
  }));

  return { trends, series, computed_at: new Date().toISOString() };
}

// 자동 생성: 기존 management_reports/생산성/품질 데이터에서 KPI 추출 시도
// (없으면 빈 kpi)
export async function autoExtractKpi(year, month) {
  const out = { production: {}, quality: {} };
  try {
    const { data } = await supabaseAdmin
      .from('management_reports')
      .select('production, quality')
      .eq('year', year).eq('month', month).maybeSingle();
    if (data?.production && typeof data.production === 'object') {
      const p = data.production;
      out.production = {
        actual_qty: numOrNull(p.actual_qty),
        plan_qty:   numOrNull(p.plan_qty),
        eff:        numOrNull(p.actual_eff ?? p.eff),
        oee:        numOrNull(p.actual_oee ?? p.oee),
      };
    }
    if (data?.quality && typeof data.quality === 'object') {
      const q = data.quality;
      out.quality = {
        customer_ppm:  numOrNull(q.customer_ppm),
        inprocess_ppm: numOrNull(q.inprocess_ppm),
        incoming_ppm:  numOrNull(q.incoming_ppm),
        claim_cost:    numOrNull(q.claim_cost),
      };
    }
  } catch (e) {
    console.error('[mpr] autoExtractKpi:', e?.message);
  }
  return out;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 최근 N개월 + 전년 동월 1건을 묶어 반환
export async function fetchHistory(year, month, monthsBack = 6) {
  // 직전 N개월
  const list = [];
  const d = new Date(year, month - 1, 1);
  for (let i = 1; i <= monthsBack; i++) {
    d.setMonth(d.getMonth() - 1);
    list.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  // 전년 동월
  const yoy = { y: year - 1, m: month, _yoy: true };

  const conds = [...list, yoy];
  const { data, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .select('year, month, kpi')
    .in('year', [...new Set(conds.map((c) => c.y))]);
  if (error) return [];

  const found = (data || []).filter((r) =>
    conds.some((c) => c.y === r.year && c.m === r.month)
  );
  // YoY 표시
  return found
    .map((r) => ({ ...r, _yoy: r.year === yoy.y && r.month === yoy.m }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));
}
