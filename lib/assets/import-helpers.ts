/**
 * Pure helper functions used by the import endpoints.
 * Kept side-effect free for easy unit testing.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
export const ALLOWED_MIME_PREFIXES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

export const VALID_BATCH_STATUSES = ['pending', 'processing', 'completed', 'failed'];
export const VALID_ITEM_STATUSES = ['pending', 'validating', 'success', 'error', 'skipped'];

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidExcelFile(meta: {
  name?: string;
  type?: string;
}): { valid: boolean; reason?: string } {
  const lowerName = (meta.name || '').toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!extOk) {
    return { valid: false, reason: 'File must be .xlsx or .xls' };
  }
  const mime = (meta.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return { valid: false, reason: `Unexpected MIME type: ${meta.type}` };
  }
  return { valid: true };
}

export function normalizePage(raw: string | null, defaultPage = 1): number {
  const parsed = parseInt(raw || `${defaultPage}`);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPage;
}

export function normalizePerPage(
  raw: string | null,
  defaultPerPage = 20,
  maxPerPage = 100
): number {
  const parsed = parseInt(raw || `${defaultPerPage}`);
  const safe = Number.isFinite(parsed) ? parsed : defaultPerPage;
  return Math.min(Math.max(safe, 1), maxPerPage);
}

export function isValidUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return UUID_RE.test(s);
}

/**
 * Computes which rows have duplicate machine_asset_number
 * — duplicates inside the file plus duplicates against an existing-tags set.
 */
export interface DuplicateAnalysis {
  duplicate_in_file: number;
  duplicate_in_db: number;
  rowsWithErrors: Array<{ row_number: number; errors: string[] }>;
}

export function analyzeDuplicates(
  rows: Array<{ row_number: number; data: Record<string, any>; errors: string[] }>,
  existingTagsInDb: Set<string>
): DuplicateAnalysis {
  const tagCounts = new Map<string, number>();
  for (const r of rows) {
    const t = r.data?.machine_asset_number;
    if (t) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }

  let duplicate_in_db = 0;
  let duplicate_in_file = 0;

  for (const r of rows) {
    const tag = r.data?.machine_asset_number;
    if (tag && existingTagsInDb.has(tag)) {
      r.errors.push(`Duplicate machine_asset_number (already exists in DB): ${tag}`);
      duplicate_in_db++;
    }
    if (tag && (tagCounts.get(tag) || 0) > 1) {
      r.errors.push(`Duplicate machine_asset_number within file: ${tag}`);
      duplicate_in_file++;
    }
  }

  return {
    duplicate_in_file,
    duplicate_in_db,
    rowsWithErrors: rows.map((r) => ({ row_number: r.row_number, errors: r.errors })),
  };
}

/**
 * Computes the final batch status from per-item results.
 */
export function deriveBatchStatus(success: number, failed: number): 'completed' | 'failed' {
  if (failed === 0) return 'completed';
  if (success === 0) return 'failed';
  return 'completed'; // partial success
}
