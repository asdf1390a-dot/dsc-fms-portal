import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface DisposeRequest {
  disposal_reason: string;
  disposal_date: string; // YYYY-MM-DD
  disposal_certificate_url?: string;
  notes?: string;
}

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
function err(message: string, status = 400, field?: string) {
  return NextResponse.json(
    { success: false, error: { message, field } },
    { status }
  );
}

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST /api/assets/[assetId]/dispose — Phase 3-3 disposal
export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return err('Unauthorized', 401);

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return err('Invalid token', 401);

    // Load asset
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', params.assetId)
      .single();
    if (assetError || !asset) return err('Asset not found', 404);

    // Already disposed?
    if (asset.status === 'sold' || asset.status === 'scrapped' || asset.status === 'disposed') {
      return err('Asset is already disposed', 409);
    }

    // Parse + validate payload
    let payload: DisposeRequest;
    try {
      payload = await request.json();
    } catch {
      return err('Invalid JSON body', 400);
    }

    const reason = (payload.disposal_reason || '').trim();
    if (!reason) return err('disposal_reason is required', 400, 'disposal_reason');
    if (reason.length < 10)
      return err('disposal_reason must be at least 10 characters', 400, 'disposal_reason');
    if (reason.length > 500)
      return err('disposal_reason must be at most 500 characters', 400, 'disposal_reason');

    const dateStr = (payload.disposal_date || '').trim();
    if (!dateStr) return err('disposal_date is required', 400, 'disposal_date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      return err('disposal_date must be YYYY-MM-DD', 400, 'disposal_date');
    const disposalDate = new Date(dateStr + 'T00:00:00Z');
    if (Number.isNaN(disposalDate.getTime()))
      return err('disposal_date is not a valid date', 400, 'disposal_date');
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    if (disposalDate.getTime() > today.getTime())
      return err('disposal_date cannot be in the future', 400, 'disposal_date');

    const certUrl = (payload.disposal_certificate_url || '').trim();
    if (certUrl && !isValidUrl(certUrl))
      return err('disposal_certificate_url must be a valid http(s) URL', 400, 'disposal_certificate_url');

    const notes = (payload.notes || '').trim();
    if (notes.length > 1000)
      return err('notes must be at most 1000 characters', 400, 'notes');

    // 1) Update asset row first (always works — primary source of truth pre-db/46)
    const nowIso = new Date().toISOString();
    const assetUpdate: Record<string, any> = {
      status: 'sold',
      disposal_reason: reason,
      disposed_at: disposalDate.toISOString(),
      updated_by: user.id,
      updated_at: nowIso,
    };

    const { data: updatedAsset, error: updateError } = await supabase
      .from('assets')
      .update(assetUpdate)
      .eq('id', params.assetId)
      .select()
      .single();

    if (updateError) {
      console.error('[dispose] asset update failed:', updateError);
      return err('Failed to mark asset as disposed', 500);
    }

    // 2) Best-effort: write asset_disposals log row (graceful degradation if table absent)
    let logged = false;
    let logWarning: string | null = null;
    try {
      const logRow: Record<string, any> = {
        asset_id: params.assetId,
        disposed_by: user.id,
        disposal_reason: reason,
        disposed_at: disposalDate.toISOString(),
        note: notes || null,
        disposal_certificate_url: certUrl || null,
      };

      const { error: logError } = await supabase
        .from('asset_disposals')
        .insert(logRow);

      if (logError) {
        // 42P01 = undefined_table
        if (logError.code === '42P01') {
          logWarning = 'asset_disposals table missing — disposal recorded on asset only (run db/46)';
          console.warn('[dispose] graceful degrade:', logWarning);
        } else if (logError.code === '42703') {
          // undefined_column — retry without certificate_url
          const { error: retryError } = await supabase
            .from('asset_disposals')
            .insert({
              asset_id: params.assetId,
              disposed_by: user.id,
              disposal_reason: reason,
              disposed_at: disposalDate.toISOString(),
              note: notes
                ? `${notes}${certUrl ? `\n[certificate_url] ${certUrl}` : ''}`
                : certUrl
                ? `[certificate_url] ${certUrl}`
                : null,
            });
          if (retryError) {
            logWarning = `asset_disposals insert failed: ${retryError.message}`;
            console.warn('[dispose] retry failed:', retryError);
          } else {
            logged = true;
            logWarning = 'disposal_certificate_url column missing — stored in note';
          }
        } else {
          logWarning = `asset_disposals insert failed: ${logError.message}`;
          console.warn('[dispose] log insert failed:', logError);
        }
      } else {
        logged = true;
      }
    } catch (e) {
      logWarning = e instanceof Error ? e.message : 'asset_disposals log unavailable';
      console.warn('[dispose] log exception:', logWarning);
    }

    return ok({
      asset: updatedAsset,
      disposal: {
        asset_id: params.assetId,
        disposal_reason: reason,
        disposal_date: dateStr,
        disposal_certificate_url: certUrl || null,
        notes: notes || null,
        disposed_by: user.id,
        disposed_at: disposalDate.toISOString(),
      },
      logged,
      warning: logWarning,
    });
  } catch (e) {
    console.error('[dispose] fatal:', e);
    return err(e instanceof Error ? e.message : 'Server error', 500);
  }
}
