import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface DisposeRequest {
  disposal_reason: string;
  disposal_price?: number;
  buyer_name?: string;
  buyer_contact?: string;
  disposed_at?: string;
}

// POST /api/assets/[assetId]/dispose — 매각 등록
export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 인증된 사용자 확인
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 자산 존재 확인
    const { data: asset } = await supabase
      .from('assets')
      .select('*')
      .eq('id', params.assetId)
      .single();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // 요청 데이터 파싱
    const payload: DisposeRequest = await request.json();

    // 필수 필드 검증
    if (!payload.disposal_reason) {
      return NextResponse.json(
        { error: 'Disposal reason is required' },
        { status: 400 }
      );
    }

    // disposal_reason 검증
    const validReasons = ['노후화', '폐기', '선물', '기타'];
    if (!validReasons.includes(payload.disposal_reason) &&
        payload.disposal_reason !== '기타') {
      // '기타'는 텍스트값도 허용
      if (!payload.disposal_reason.startsWith('기타:')) {
        // 기타 사유가 특정 형식이 아니면 저장
      }
    }

    // 자산 업데이트 (상태를 'sold'로 변경하고 매각 정보 저장)
    const updateData: any = {
      status: 'sold',
      disposal_reason: payload.disposal_reason,
      disposed_at: payload.disposed_at || new Date().toISOString(),
      updated_by: user.id,
    };

    if (payload.disposal_price !== undefined) {
      updateData.disposal_price = payload.disposal_price;
    }
    if (payload.buyer_name) {
      updateData.buyer_name = payload.buyer_name;
    }
    if (payload.buyer_contact) {
      updateData.buyer_contact = payload.buyer_contact;
    }

    const { data: updatedAsset, error: updateError } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', params.assetId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update asset' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedAsset, { status: 200 });
  } catch (error) {
    console.error('Dispose error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
