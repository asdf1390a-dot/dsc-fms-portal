import { createClient } from '@supabase/supabase-js';
import { CreateAssetRequest, CreateAssetResponse, Asset, ApiResponse } from '@/lib/assets/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '20'), 100);
    const q = url.searchParams.get('q');
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const location = url.searchParams.get('location');
    const make = url.searchParams.get('make');
    const sort_by = url.searchParams.get('sort_by') || 'updated_at';
    const sort_order = url.searchParams.get('sort_order') || 'desc';

    const offset = (page - 1) * per_page;

    let query = supabase
      .from('assets')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (category) {
      query = query.eq('asset_class_code', category);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }
    if (make) {
      query = query.eq('make', make);
    }
    // 검색: name_en / name_ta / model / serial_no / machine_asset_number
    if (q && q.trim().length > 0) {
      const term = q.trim().replace(/%/g, '');
      query = query.or(
        `name_en.ilike.%${term}%,name_ta.ilike.%${term}%,model.ilike.%${term}%,serial_no.ilike.%${term}%,machine_asset_number.ilike.%${term}%`
      );
    }

    // 정렬 적용
    const orderDirection = sort_order === 'asc' ? false : true;
    query = query.order(sort_by, { ascending: !orderDirection });

    // 페이지네이션
    query = query.range(offset, offset + per_page - 1);

    const { data: assets, count, error } = await query;

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    const total_pages = count ? Math.ceil(count / per_page) : 0;

    return Response.json({
      success: true,
      data: assets || [],
      total: count || 0,
      page,
      per_page,
      total_pages,
    });
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

export async function POST(request: Request): Promise<Response> {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const payload: CreateAssetRequest = await request.json();

    // 입력 검증
    const validation = validateAssetInput(payload);
    if (!validation.valid) {
      return Response.json(
        {
          success: false,
          error: { message: validation.message, field: validation.field },
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 - 인증된 사용자로 설정
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // 현재 사용자 조회
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return Response.json(
        { success: false, error: { message: 'Invalid token' } },
        { status: 401 }
      );
    }

    // 물리 태그 중복 검증
    const { data: existing } = await supabase
      .from('assets')
      .select('id')
      .eq('machine_asset_number', payload.machine_asset_number)
      .single();

    if (existing) {
      return Response.json(
        {
          success: false,
          error: {
            message: 'Physical tag already exists',
            field: 'machine_asset_number',
          },
        },
        { status: 400 }
      );
    }

    // asset_class_code 존재 여부 검증
    const { data: assetClass } = await supabase
      .from('asset_classes')
      .select('code')
      .eq('code', payload.asset_class_code)
      .single();

    if (!assetClass) {
      return Response.json(
        {
          success: false,
          error: {
            message: 'Asset class not found',
            field: 'asset_class_code',
          },
        },
        { status: 400 }
      );
    }

    // 신규 자산 생성
    const { data: newAsset, error: insertError } = await supabase
      .from('assets')
      .insert([
        {
          asset_class_code: payload.asset_class_code,
          machine_asset_number: payload.machine_asset_number,
          serial_no: payload.serial_no || null,
          name_en: payload.name_en,
          name_ta: payload.name_ta || null,
          model: payload.model || null,
          make: payload.make || null,
          year_of_manufacture: payload.year_of_manufacture || null,
          location: payload.location,
          status: payload.status,
          remark: payload.remark || null,
          photos: payload.photos || [],
          created_by: user.id,
          updated_by: user.id,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return Response.json(
        { success: false, error: { message: insertError.message } },
        { status: 500 }
      );
    }

    const response: CreateAssetResponse = {
      success: true,
      data: newAsset,
      message: 'Asset created successfully',
    };

    return Response.json(response, { status: 201 });
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

// 입력 검증 함수
function validateAssetInput(data: CreateAssetRequest): {
  valid: boolean;
  message?: string;
  field?: string;
} {
  // 필수 필드
  if (!data.asset_class_code) {
    return { valid: false, message: 'Asset class is required', field: 'asset_class_code' };
  }
  if (!data.machine_asset_number) {
    return {
      valid: false,
      message: 'Physical tag is required',
      field: 'machine_asset_number',
    };
  }
  if (!data.name_en) {
    return { valid: false, message: 'English name is required', field: 'name_en' };
  }
  if (!data.location) {
    return { valid: false, message: 'Location is required', field: 'location' };
  }
  if (!data.status) {
    return { valid: false, message: 'Status is required', field: 'status' };
  }

  // 길이 제한
  if (data.name_en.length > 100) {
    return {
      valid: false,
      message: 'English name must be 100 characters or less',
      field: 'name_en',
    };
  }
  if (data.remark && data.remark.length > 500) {
    return {
      valid: false,
      message: 'Remarks must be 500 characters or less',
      field: 'remark',
    };
  }

  // 제조년도 검증
  if (data.year_of_manufacture) {
    if (!Number.isInteger(data.year_of_manufacture)) {
      return {
        valid: false,
        message: 'Year of manufacture must be an integer',
        field: 'year_of_manufacture',
      };
    }
    if (data.year_of_manufacture < 1950 || data.year_of_manufacture > 2026) {
      return {
        valid: false,
        message: 'Year of manufacture must be between 1950 and 2026',
        field: 'year_of_manufacture',
      };
    }
  }

  // 상태 검증
  const validStatuses = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];
  if (!validStatuses.includes(data.status)) {
    return { valid: false, message: 'Invalid status', field: 'status' };
  }

  return { valid: true };
}
