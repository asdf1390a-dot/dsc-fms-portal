// Shared field validation utilities for Breakdown Management Phase 2.
// Pure functions — no DB access. Each validator returns null on pass,
// or { field, code, message } on failure.

export const SEVERITY_VALUES = ['minor', 'normal', 'major', 'line_down'];
export const SEVERITY_RANK = { minor: 0, normal: 1, major: 2, line_down: 3 };
export const CATEGORY_VALUES = [
  'mechanical', 'electrical', 'hydraulic', 'software', 'operator_error', 'unknown',
];
export const STATUS_VALUES = [
  'reported', 'acknowledged', 'in_progress', 'resolved', 'won_fix',
];

// Valid status transitions: from -> [allowed to]
export const STATUS_TRANSITIONS = {
  reported:     ['acknowledged', 'in_progress', 'resolved', 'won_fix'], // escalate fast-track
  acknowledged: ['in_progress', 'resolved', 'won_fix'],
  in_progress:  ['resolved', 'won_fix'],
  resolved:     [],   // locked
  won_fix:      [],   // locked
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isIsoTimestamp(v) {
  if (typeof v !== 'string') return false;
  if (!ISO_RE.test(v)) {
    // Allow Date.parse fallback for slightly looser formats
    const t = Date.parse(v);
    if (Number.isNaN(t)) return false;
  }
  return !Number.isNaN(Date.parse(v));
}

export function validateUuid(field, v) {
  if (!isUuid(v)) {
    return { field, code: 'INVALID_UUID', message: `${field} must be a valid UUID. Got: ${v}` };
  }
  return null;
}

export function validateEnum(field, v, allowed) {
  if (!allowed.includes(v)) {
    return {
      field, code: 'INVALID_ENUM',
      message: `Valid values: ${allowed.join(', ')}. Got: ${v}`,
    };
  }
  return null;
}

export function validateLength(field, v, min, max) {
  if (typeof v !== 'string') {
    return { field, code: 'TYPE_ERROR', message: `${field} must be a string` };
  }
  const len = v.length;
  if (len < min || len > max) {
    return {
      field, code: 'LENGTH_ERROR',
      message: `Length must be ${min}-${max}, got: ${len}`,
    };
  }
  return null;
}

export function validateTimestamp(field, v) {
  if (!isIsoTimestamp(v)) {
    return {
      field, code: 'INVALID_TIMESTAMP',
      message: `${field} must be an ISO 8601 timestamp. Got: ${v}`,
    };
  }
  return null;
}

export function validateTimestampOrder(field, v, ref, refName) {
  if (new Date(v).getTime() < new Date(ref).getTime()) {
    return {
      field, code: 'INVALID_TIMESTAMP',
      message: `${field} must be >= ${refName}. Got: ${v}, expected: >= ${ref}`,
    };
  }
  return null;
}

export function validateStringArray(field, arr, maxItems, maxItemLen) {
  if (!Array.isArray(arr)) {
    return { field, code: 'TYPE_ERROR', message: `${field} must be an array` };
  }
  if (arr.length > maxItems) {
    return {
      field, code: 'ARRAY_ERROR',
      message: `Max ${maxItems} items, got: ${arr.length}`,
    };
  }
  for (const s of arr) {
    if (typeof s !== 'string' || s.length > maxItemLen) {
      return {
        field, code: 'ARRAY_ERROR',
        message: `Each item must be a string <= ${maxItemLen} chars`,
      };
    }
  }
  return null;
}

// Validate the request body for a status transition.
// `current` is the existing breakdown row.
// `body` is the incoming patch.
// Returns { errors: [...], patch: {...} } where patch is the column updates to apply.
export function validateTransition(current, target, body) {
  const errors = [];
  const patch = { status: target };

  // Enum check
  const enumErr = validateEnum('status', target, STATUS_VALUES);
  if (enumErr) return { errors: [enumErr], patch: null };

  // Transition allowed?
  const allowed = STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(target)) {
    return {
      errors: [{
        field: 'status', code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from '${current.status}' to '${target}'`,
      }],
      patch: null,
    };
  }

  if (target === 'acknowledged') {
    if (!body.assigned_to) {
      errors.push({ field: 'assigned_to', code: 'MISSING_REQUIRED_FIELD', message: 'assigned_to is required' });
    } else {
      const e = validateUuid('assigned_to', body.assigned_to);
      if (e) errors.push(e);
      else patch.assigned_to = body.assigned_to;
    }
    patch.acknowledged_at = body.acknowledged_at || new Date().toISOString();
    const tsErr = validateTimestamp('acknowledged_at', patch.acknowledged_at);
    if (tsErr) errors.push(tsErr);
  }

  if (target === 'in_progress') {
    const started = body.started_at || new Date().toISOString();
    const tsErr = validateTimestamp('started_at', started);
    if (tsErr) {
      errors.push(tsErr);
    } else {
      const ordErr = validateTimestampOrder('started_at', started, current.reported_at, 'reported_at');
      if (ordErr) errors.push(ordErr);
      patch.started_at = started;
    }
    if (body.category !== undefined && body.category !== null) {
      const ce = validateEnum('category', body.category, CATEGORY_VALUES);
      if (ce) errors.push(ce); else patch.category = body.category;
    }
    if (body.root_cause !== undefined && body.root_cause !== null && body.root_cause !== '') {
      const re = validateLength('root_cause', body.root_cause, 0, 500);
      if (re) errors.push(re); else patch.root_cause = body.root_cause;
    }
  }

  if (target === 'resolved') {
    const resolved = body.resolved_at || new Date().toISOString();
    const tsErr = validateTimestamp('resolved_at', resolved);
    if (tsErr) {
      errors.push(tsErr);
    } else {
      const ref = current.started_at || current.reported_at;
      const refName = current.started_at ? 'started_at' : 'reported_at';
      const ordErr = validateTimestampOrder('resolved_at', resolved, ref, refName);
      if (ordErr) errors.push(ordErr);
      patch.resolved_at = resolved;
    }
    if (!body.action_taken) {
      errors.push({ field: 'action_taken', code: 'MISSING_REQUIRED_FIELD', message: 'action_taken is required' });
    } else {
      const le = validateLength('action_taken', body.action_taken, 10, 1000);
      if (le) errors.push(le); else patch.action_taken = body.action_taken;
    }
    if (body.root_cause !== undefined && body.root_cause !== null && body.root_cause !== '') {
      const re = validateLength('root_cause', body.root_cause, 0, 500);
      if (re) errors.push(re); else patch.root_cause = body.root_cause;
    }
    // If skipping started_at (fast-track resolve), back-fill
    if (!current.started_at && !body.started_at) {
      patch.started_at = current.reported_at;
    } else if (!current.started_at && body.started_at) {
      patch.started_at = body.started_at;
    }
  }

  if (target === 'won_fix') {
    if (!body.reason) {
      errors.push({ field: 'reason', code: 'MISSING_REQUIRED_FIELD', message: 'reason is required' });
    } else {
      const le = validateLength('reason', body.reason, 10, 500);
      if (le) errors.push(le);
    }
  }

  return { errors, patch, reason: body.reason || null };
}

// Validate the description/severity/asset_id used at creation time.
export function validateCreatePayload(body) {
  const errors = [];
  if (!body.asset_id) {
    errors.push({ field: 'asset_id', code: 'MISSING_REQUIRED_FIELD', message: 'asset_id is required' });
  } else {
    const e = validateUuid('asset_id', body.asset_id);
    if (e) errors.push(e);
  }
  if (!body.description) {
    errors.push({ field: 'description', code: 'MISSING_REQUIRED_FIELD', message: 'description is required' });
  } else {
    const e = validateLength('description', body.description, 10, 2000);
    if (e) errors.push(e);
  }
  if (body.severity !== undefined) {
    const e = validateEnum('severity', body.severity, SEVERITY_VALUES);
    if (e) errors.push(e);
  }
  if (body.photos !== undefined) {
    const e = validateStringArray('photos', body.photos, 10, 500);
    if (e) errors.push(e);
  }
  if (body.documents !== undefined) {
    const e = validateStringArray('documents', body.documents, 5, 500);
    if (e) errors.push(e);
  }
  return errors;
}
