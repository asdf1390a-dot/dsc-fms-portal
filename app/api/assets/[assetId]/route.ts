import { createClient } from '@supabase/supabase-js';
import { Asset, ApiResponse } from '@/lib/assets/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function GET(
  request: Request,
  { params }: { params: { assetId: string } }
): Promise<Response> {
  try {
    const { assetId } = params;

    const { data: asset, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json(
          { success: false, error: { message: 'Asset not found' } },
          { status: 404 }
        );
      }
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    const response: ApiResponse<Asset> = {
      success: true,
      data: asset as Asset,
    };

    return Response.json(response);
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}

// PUT — update asset (authenticated)
const UPDATABLE_FIELDS = [
  'asset_class_code',
  'machine_asset_number',
  'serial_no',
  'name_en',
  'name_ta',
  'model',
  'make',
  'year_of_manufacture',
  'location',
  'status',
  'remark',
  'photos',
] as const;

const VALID_STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];

async function authenticate(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { user: null, error: 'Missing token' };

  // Allow test token in development
  if (process.env.NODE_ENV !== 'production' && token === 'test-token') {
    return { user: { id: '600be417-5613-4211-a4e8-4a6fcdb4b54b' }, error: null };
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { user: null, error: 'Invalid token' };
  return { user, error: null };
}

export async function PUT(
  request: Request,
  { params }: { params: { assetId: string } }
): Promise<Response> {
  try {
    const { user, error: authErr } = await authenticate(request);
    if (!user) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { assetId } = params;
    const payload = await request.json();

    // Whitelist fields
    const update: Record<string, any> = { updated_by: user.id };
    for (const key of UPDATABLE_FIELDS) {
      if (key in payload) update[key] = payload[key];
    }

    // Validation
    if ('status' in update && !VALID_STATUSES.includes(update.status)) {
      return Response.json(
        { success: false, error: { message: 'Invalid status', field: 'status' } },
        { status: 400 }
      );
    }
    if ('name_en' in update && (!update.name_en || update.name_en.length > 100)) {
      return Response.json(
        { success: false, error: { message: 'name_en required (max 100)', field: 'name_en' } },
        { status: 400 }
      );
    }
    if ('year_of_manufacture' in update && update.year_of_manufacture != null) {
      const y = update.year_of_manufacture;
      if (!Number.isInteger(y) || y < 1950 || y > 2026) {
        return Response.json(
          { success: false, error: { message: 'Invalid year', field: 'year_of_manufacture' } },
          { status: 400 }
        );
      }
    }

    // Unique check for machine_asset_number when changed
    if ('machine_asset_number' in update) {
      const { data: existing } = await supabase
        .from('assets')
        .select('id')
        .eq('machine_asset_number', update.machine_asset_number)
        .neq('id', assetId)
        .maybeSingle();
      if (existing) {
        return Response.json(
          {
            success: false,
            error: { message: 'Physical tag already exists', field: 'machine_asset_number' },
          },
          { status: 409 }
        );
      }
    }

    const { data: updated, error } = await supabase
      .from('assets')
      .update(update)
      .eq('id', assetId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json(
          { success: false, error: { message: 'Asset not found' } },
          { status: 404 }
        );
      }
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data: updated, message: 'Asset updated' });
  } catch (error) {
    console.error('PUT error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { assetId: string } }
): Promise<Response> {
  try {
    const { user, error: authErr } = await authenticate(request);
    if (!user) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { assetId } = params;

    // Use RPC function for safe deletion with audit logging
    const { data, error } = await supabase.rpc('delete_asset_with_audit', {
      p_asset_id: assetId,
      p_deleted_by: user.id,
    });

    if (error) {
      console.error('Asset deletion error:', error);

      // Check if asset not found
      if (error.message.includes('not found')) {
        return Response.json(
          { success: false, error: { message: 'Asset not found' } },
          { status: 404 }
        );
      }

      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    console.error('DELETE error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
