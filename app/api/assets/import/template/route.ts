import ExcelJS from 'exceljs';

/**
 * GET /api/assets/import/template
 * Returns an Excel template with header row + sample row.
 */
export async function GET(): Promise<Response> {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DSC FMS Portal';
    wb.created = new Date();

    const ws = wb.addWorksheet('Assets', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headers = [
      { key: 'asset_class_code', header: 'asset_class_code', width: 16 },
      { key: 'machine_asset_number', header: 'machine_asset_number', width: 22 },
      { key: 'serial_no', header: 'serial_no', width: 18 },
      { key: 'name_en', header: 'name_en', width: 28 },
      { key: 'name_ta', header: 'name_ta', width: 22 },
      { key: 'model', header: 'model', width: 18 },
      { key: 'make', header: 'make', width: 16 },
      { key: 'year_of_manufacture', header: 'year_of_manufacture', width: 14 },
      { key: 'location', header: 'location', width: 20 },
      { key: 'status', header: 'status', width: 14 },
      { key: 'remark', header: 'remark', width: 30 },
    ];
    ws.columns = headers;

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Sample row
    ws.addRow({
      asset_class_code: '01.001',
      machine_asset_number: 'DCMI-UTL-PSF-99',
      serial_no: 'SN-EXAMPLE-001',
      name_en: 'SAMPLE SUB STATION',
      name_ta: 'மாதிரி சப் ஸ்டேஷன்',
      model: 'EB-MODEL-X',
      make: 'TRINITY',
      year_of_manufacture: 2020,
      location: 'EB YARD',
      status: 'active',
      remark: 'Delete this row before import',
    });

    const buf = await wb.xlsx.writeBuffer();

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="asset_import_template.xlsx"',
      },
    });
  } catch (error) {
    console.error('template error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
