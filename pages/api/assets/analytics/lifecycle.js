// GET /api/assets/analytics/lifecycle
// Phase 3-4 — Asset lifecycle analytics (creation → disposal patterns).
//
// Query:
//   group_by?  'category' | 'location' | 'status'  (default: 'category')
//
// Returns:
//   - total_assets_created
//   - total_disposed
//   - disposal_rate_percent
//   - average_lifespan_days (created_at → disposed_at)
//   - premature_disposals (lifespan < 365 days)
//   - by_group: per-group breakdown
//
// Auth: anon read allowed (analytics summary).
// Gracefully degrades when asset_disposals is missing.

import { supabaseAdmin } from '../../../../lib/supabase-admin';

const ALLOWED_GROUP_BY = new Set(['category', 'location', 'status']);
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const groupBy = ALLOWED_GROUP_BY.has(req.query.group_by)
    ? req.query.group_by
    : 'category';

  try {
    // Pull all assets (lightweight columns).
    const { data: assets, error: assetsErr } = await supabaseAdmin
      .from('assets')
      .select('id, category_id, location, status, created_at, disposed_at');
    if (assetsErr) return res.status(500).json({ error: assetsErr.message });

    // Optional category labels for grouping.
    let categoryMap = new Map();
    if (groupBy === 'category') {
      const { data: cats } = await supabaseAdmin
        .from('categories')
        .select('id, name_en, code');
      for (const c of cats || []) {
        categoryMap.set(c.id, c.name_en || c.code || String(c.id));
      }
    }

    const totalCreated = (assets || []).length;
    const disposed = (assets || []).filter(
      (a) => a.disposed_at && ['sold', 'scrapped', 'disposed'].includes(a.status),
    );
    const totalDisposed = disposed.length;

    // Lifespan stats (only over disposed assets that have created_at).
    const lifespans = disposed
      .map((a) => {
        if (!a.created_at || !a.disposed_at) return null;
        const created = new Date(a.created_at).getTime();
        const dispAt = new Date(a.disposed_at).getTime();
        if (Number.isNaN(created) || Number.isNaN(dispAt)) return null;
        return Math.max(0, Math.round((dispAt - created) / MS_PER_DAY));
      })
      .filter((n) => n !== null);

    const avgLifespan = lifespans.length
      ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
      : 0;
    const prematureCount = lifespans.filter((d) => d < 365).length;

    // Group breakdown.
    const groups = {};
    for (const a of assets || []) {
      let key;
      if (groupBy === 'category') {
        key = categoryMap.get(a.category_id) || '(uncategorized)';
      } else if (groupBy === 'location') {
        key = a.location || '(unknown)';
      } else {
        key = a.status || '(unknown)';
      }
      const g = groups[key] || (groups[key] = { created: 0, disposed: 0, lifespans: [] });
      g.created += 1;
      if (a.disposed_at && ['sold', 'scrapped', 'disposed'].includes(a.status)) {
        g.disposed += 1;
        const created = new Date(a.created_at).getTime();
        const dispAt = new Date(a.disposed_at).getTime();
        if (!Number.isNaN(created) && !Number.isNaN(dispAt)) {
          g.lifespans.push(Math.max(0, Math.round((dispAt - created) / MS_PER_DAY)));
        }
      }
    }

    const byGroup = Object.entries(groups).map(([key, v]) => ({
      key,
      created: v.created,
      disposed: v.disposed,
      disposal_rate_percent:
        v.created > 0 ? Number(((v.disposed / v.created) * 100).toFixed(2)) : 0,
      avg_lifespan_days: v.lifespans.length
        ? Math.round(v.lifespans.reduce((a, b) => a + b, 0) / v.lifespans.length)
        : 0,
    }));
    byGroup.sort((a, b) => b.created - a.created);

    return res.status(200).json({
      success: true,
      group_by: groupBy,
      lifecycle_stats: {
        total_assets_created: totalCreated,
        total_disposed: totalDisposed,
        active_assets: totalCreated - totalDisposed,
        disposal_rate_percent:
          totalCreated > 0
            ? Number(((totalDisposed / totalCreated) * 100).toFixed(2))
            : 0,
        average_lifespan_days: avgLifespan,
        premature_disposals: prematureCount,
        premature_disposal_threshold_days: 365,
      },
      by_group: byGroup,
    });
  } catch (e) {
    console.error('[assets/analytics/lifecycle] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
