// POST /api/pm/validate/plan-config
// Body: { plan_id?: uuid, plan?: { title, frequency_days, frequency_label, category, checklist, estimated_hours } }
// Returns: { ok: bool, issues: [{ field, code, message, severity }] }
//
// Validates PM plan integrity. Can validate either an existing plan (by plan_id) or a
// proposed plan payload (for pre-save validation in the UI).
//
// Rules:
//   - title: required, length 3..200
//   - frequency_days: required, integer 1..730 (max 2 years)
//   - frequency_label vs frequency_days consistency:
//       daily=1, weekly=7, biweekly=14, monthly=30, quarterly=90, biannual=180, annual=365
//       Mismatches generate a 'warning' (±20% tolerance) not a hard error.
//   - category: optional but if present must be in enum
//   - checklist: array of objects {item: text, required?: bool}; max 50 items
//   - estimated_hours: 0.1..24

import { supabaseAdmin } from '../../../../lib/supabase-admin';

const FREQ_MAP = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30,
  quarterly: 90, biannual: 180, annual: 365,
};
const VALID_CATEGORIES = ['lubrication', 'inspection', 'calibration', 'cleaning', 'general'];

function validatePlan(plan) {
  const issues = [];
  const push = (field, code, message, severity = 'error') =>
    issues.push({ field, code, message, severity });

  if (!plan || typeof plan !== 'object') {
    push('plan', 'MISSING', 'plan object is required');
    return issues;
  }

  // title
  const title = (plan.title || '').toString().trim();
  if (!title) push('title', 'REQUIRED', 'title is required');
  else if (title.length < 3) push('title', 'TOO_SHORT', 'title must be at least 3 characters');
  else if (title.length > 200) push('title', 'TOO_LONG', 'title must be 200 characters or less');

  // frequency_days
  const fd = plan.frequency_days;
  if (fd == null) {
    push('frequency_days', 'REQUIRED', 'frequency_days is required');
  } else if (!Number.isInteger(fd) || fd < 1 || fd > 730) {
    push('frequency_days', 'OUT_OF_RANGE', 'frequency_days must be integer between 1 and 730');
  }

  // frequency_label consistency
  if (plan.frequency_label) {
    if (!(plan.frequency_label in FREQ_MAP)) {
      push('frequency_label', 'INVALID_ENUM', `frequency_label must be one of ${Object.keys(FREQ_MAP).join(', ')}`);
    } else if (Number.isInteger(fd)) {
      const expected = FREQ_MAP[plan.frequency_label];
      const ratio = Math.abs(fd - expected) / expected;
      if (ratio > 0.2) {
        push(
          'frequency_days',
          'LABEL_MISMATCH',
          `frequency_days=${fd} does not match label '${plan.frequency_label}' (expected ~${expected})`,
          'warning'
        );
      }
    }
  }

  // category
  if (plan.category != null && !VALID_CATEGORIES.includes(plan.category)) {
    push('category', 'INVALID_ENUM', `category must be one of ${VALID_CATEGORIES.join(', ')}`);
  }

  // checklist
  if (plan.checklist != null) {
    if (!Array.isArray(plan.checklist)) {
      push('checklist', 'WRONG_TYPE', 'checklist must be an array');
    } else if (plan.checklist.length > 50) {
      push('checklist', 'TOO_MANY', 'checklist must have at most 50 items');
    } else {
      plan.checklist.forEach((it, i) => {
        if (!it || typeof it !== 'object' || !(it.item || '').toString().trim()) {
          push(`checklist[${i}].item`, 'INVALID_ITEM', 'each checklist entry must have non-empty item text');
        }
      });
    }
  }

  // estimated_hours
  if (plan.estimated_hours != null) {
    const eh = Number(plan.estimated_hours);
    if (!Number.isFinite(eh) || eh < 0.1 || eh > 24) {
      push('estimated_hours', 'OUT_OF_RANGE', 'estimated_hours must be between 0.1 and 24');
    }
  }

  return issues;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { plan_id, plan } = req.body || {};
  let target = plan;

  if (plan_id) {
    const { data, error } = await supabaseAdmin
      .from('pm_plans')
      .select('id, title, frequency_days, frequency_label, category, checklist, estimated_hours, is_active')
      .eq('id', plan_id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'plan not found' });
    target = data;
  }

  if (!target) {
    return res.status(400).json({
      error: { message: 'either plan_id or plan body is required' },
    });
  }

  const issues = validatePlan(target);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return res.json({
    ok: errors.length === 0,
    error_count: errors.length,
    warning_count: warnings.length,
    issues,
    plan_id: plan_id || null,
    validated_at: new Date().toISOString(),
  });
}
