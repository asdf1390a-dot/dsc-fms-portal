import { createClient } from '@supabase/supabase-js';
import { Asset } from '@/lib/assets/types';

// Server-only client (service_role). RLS bypassed; we still gate reads
// behind the asset id passed in the URL.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export interface EditHistoryEntry {
  id: string;
  asset_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
}

export interface AssetClassInfo {
  code: string;
  name_en: string;
  name_ko?: string | null;
  category_code: string;
}

export interface AssetDetails {
  asset: Asset;
  asset_class: AssetClassInfo | null;
  edit_history: EditHistoryEntry[];
  edit_history_available: boolean;
}

export async function GET(
  _request: Request,
  { params }: { params: { assetId: string } }
): Promise<Response> {
  try {
    const { assetId } = params;

    // 1. Asset
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (assetErr) {
      if (assetErr.code === 'PGRST116') {
        return Response.json(
          { success: false, error: { message: 'Asset not found' } },
          { status: 404 }
        );
      }
      return Response.json(
        { success: false, error: { message: assetErr.message } },
        { status: 500 }
      );
    }

    // 2. Asset class label (best-effort)
    let assetClass: AssetClassInfo | null = null;
    if (asset?.asset_class_code) {
      const { data: cls } = await supabase
        .from('asset_classes')
        .select('code, name_en, name_ko, category_code')
        .eq('code', asset.asset_class_code)
        .maybeSingle();
      assetClass = (cls as AssetClassInfo) ?? null;
    }

    // 3. Edit history — graceful fallback if table doesn't exist yet
    let editHistory: EditHistoryEntry[] = [];
    let editHistoryAvailable = false;
    const { data: hist, error: histErr } = await supabase
      .from('asset_edit_history')
      .select('*')
      .eq('asset_id', assetId)
      .order('changed_at', { ascending: false })
      .limit(100);

    if (!histErr) {
      editHistory = (hist as EditHistoryEntry[]) || [];
      editHistoryAvailable = true;
    } else if (histErr.code !== '42P01' /* undefined_table */) {
      // Surface unexpected errors but don't fail the whole request.
      console.error('asset_edit_history fetch error:', histErr);
    }

    const payload: AssetDetails = {
      asset: asset as Asset,
      asset_class: assetClass,
      edit_history: editHistory,
      edit_history_available: editHistoryAvailable,
    };

    return Response.json({ success: true, data: payload });
  } catch (error) {
    console.error('details API error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
