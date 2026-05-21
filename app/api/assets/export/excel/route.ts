import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { getUserIdFromToken, isTokenExpired } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: Request): Promise<Response> {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    if (isTokenExpired(token)) {
      return Response.json({ success: false, error: { message: 'Token expired' } }, { status: 401 });
    }
    const userId = getUserIdFromToken(token);
    if (!userId) {
      return Response.json({ success: false, error: { message: 'Invalid token' } }, { status: 401 });
    }

    // Fetch all assets
    const { data: assets, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('자산 목록');

    // Define columns
    const columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: '자산명 (영문)', key: 'name_en', width: 20 },
      { header: '자산명 (타밀)', key: 'name_ta', width: 20 },
      { header: '자산 분류', key: 'asset_class_code', width: 15 },
      { header: '모델', key: 'model', width: 15 },
      { header: '제조사', key: 'make', width: 15 },
      { header: '제조년도', key: 'year_of_manufacture', width: 12 },
      { header: '시리얼번호', key: 'serial_no', width: 15 },
      { header: '위치', key: 'location', width: 15 },
      { header: '상태', key: 'status', width: 12 },
      { header: '생성일', key: 'created_at', width: 20 },
      { header: '수정일', key: 'updated_at', width: 20 },
    ];

    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' },
    };

    // Add data rows
    assets?.forEach((asset) => {
      worksheet.addRow({
        id: asset.id,
        name_en: asset.name_en,
        name_ta: asset.name_ta || '-',
        asset_class_code: asset.asset_class_code || '-',
        model: asset.model || '-',
        make: asset.make || '-',
        year_of_manufacture: asset.year_of_manufacture || '-',
        serial_no: asset.serial_no || '-',
        location: asset.location,
        status: asset.status,
        created_at: asset.created_at,
        updated_at: asset.updated_at || '-',
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as file
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="assets_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Server error' } },
      { status: 500 }
    );
  }
}
