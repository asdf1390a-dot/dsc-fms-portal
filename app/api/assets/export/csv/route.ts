import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all assets
    const { data: assets, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // CSV Headers
    const headers = [
      'ID',
      '자산명 (영문)',
      '자산명 (타밀)',
      '자산 분류',
      '모델',
      '제조사',
      '제조년도',
      '시리얼번호',
      '위치',
      '상태',
      '생성일',
      '수정일',
    ];

    // CSV rows
    const rows = [headers.join(',')];

    assets?.forEach((asset) => {
      const row = [
        asset.id,
        asset.name_en,
        asset.name_ta || '',
        asset.asset_class_code || '',
        asset.model || '',
        asset.make || '',
        asset.year_of_manufacture || '',
        asset.serial_no || '',
        asset.location,
        asset.status,
        new Date(asset.created_at).toLocaleString('ko-KR'),
        asset.updated_at ? new Date(asset.updated_at).toLocaleString('ko-KR') : '',
      ]
        .map((cell) => `"${cell}"`)
        .join(',');
      rows.push(row);
    });

    const csv = rows.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="assets_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
