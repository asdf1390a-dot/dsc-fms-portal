import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const monthStr = (req.query.month || '').toString();  // 'YYYY-MM' optional

  const annualRes = await supabaseAdmin.rpc('get_pm_compliance_annual', { p_year: year });
  if (annualRes.error) return res.status(500).json({ error: annualRes.error.message });

  let monthly = null;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const monthDate = `${monthStr}-01`;
    const mRes = await supabaseAdmin.rpc('get_pm_compliance_monthly', { p_month: monthDate });
    if (!mRes.error && mRes.data?.[0]) monthly = mRes.data[0];
  } else {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const mRes = await supabaseAdmin.rpc('get_pm_compliance_monthly', { p_month: cur });
    if (!mRes.error && mRes.data?.[0]) monthly = mRes.data[0];
  }

  return res.json({ year, annual: annualRes.data || [], monthly });
}
