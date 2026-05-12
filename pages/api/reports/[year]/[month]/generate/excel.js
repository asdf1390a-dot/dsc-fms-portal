// /api/reports/[year]/[month]/generate/excel
// POST: 저장된 데이터로 Excel 파일 생성 (3 시트: 생산성/품질/주간업무)
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../../../../../lib/supabase-admin';

const PROD_LABELS = [
  ['생산량 계획 (EA)',      'plan_qty'],
  ['생산량 실적 (EA)',      'actual_qty'],
  ['생산효율 계획 (%)',     'plan_eff'],
  ['생산효율 실적 (%)',     'actual_eff'],
  ['설비가동률 계획 (%)',   'plan_uptime'],
  ['설비가동률 실적 (%)',   'actual_uptime'],
  ['OEE 계획 (%)',          'plan_oee'],
  ['OEE 실적 (%)',          'actual_oee'],
  ['직접인원 (명)',         'direct_hc'],
  ['간접인원 (명)',         'indirect_hc'],
  ['인당매출 계획 (천원)',  'plan_rev_pp'],
  ['인당매출 실적 (천원)',  'actual_rev_pp'],
  ['비고',                  'note'],
];

const QUALITY_LABELS = [
  ['고객불량 건수',         'customer_count'],
  ['고객불량 PPM',          'customer_ppm'],
  ['공정불량 건수',         'inprocess_count'],
  ['공정불량 PPM',          'inprocess_ppm'],
  ['입고불량 건수',         'incoming_count'],
  ['입고불량 PPM',          'incoming_ppm'],
  ['클레임비 (백만원)',     'claim_cost'],
  ['폐기비 (백만원)',       'scrap_cost'],
  ['매출액 (INR)',          'revenue_inr'],
  ['매출액 환산 (백만원, 15.5)', 'revenue_krw'],
  ['원가절감 실적 (백만원)','cost_save'],
  ['비고',                  'note'],
];

const FX_2026 = 15.5;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'invalid year/month' });

  const { data: row, error } = await supabaseAdmin
    .from('management_reports')
    .select('*')
    .eq('year', year).eq('month', month)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!row) return res.status(404).json({ error: 'report not found' });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DSC FMS Portal';
  wb.created = new Date();

  // 공통 스타일
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true };
  const titleFont  = { size: 14, bold: true };

  // === 시트 1: 생산성 ===
  const sProd = wb.addWorksheet('생산성');
  sProd.columns = [{ width: 28 }, { width: 22 }];
  sProd.getCell('A1').value = `${year}년 ${month}월 생산성`;
  sProd.getCell('A1').font = titleFont;
  sProd.mergeCells('A1:B1');
  const hdrP = sProd.getRow(3);
  hdrP.getCell(1).value = '항목';
  hdrP.getCell(2).value = '값';
  hdrP.eachCell(c => { c.fill = headerFill; c.font = headerFont; });
  let r = 4;
  for (const [label, key] of PROD_LABELS) {
    sProd.getCell(`A${r}`).value = label;
    sProd.getCell(`B${r}`).value = row.production?.[key] ?? '';
    r++;
  }

  // === 시트 2: 품질지수 ===
  const sQ = wb.addWorksheet('품질지수');
  sQ.columns = [{ width: 32 }, { width: 22 }];
  sQ.getCell('A1').value = `${year}년 ${month}월 품질지수`;
  sQ.getCell('A1').font = titleFont;
  sQ.mergeCells('A1:B1');
  const hdrQ = sQ.getRow(3);
  hdrQ.getCell(1).value = '항목';
  hdrQ.getCell(2).value = '값';
  hdrQ.eachCell(c => { c.fill = headerFill; c.font = headerFont; });
  r = 4;
  const q = row.quality || {};
  const revInr = parseFloat(q.revenue_inr);
  const revKrw = !isNaN(revInr) ? Math.round(revInr * FX_2026 / 1_000_000) : '';
  for (const [label, key] of QUALITY_LABELS) {
    sQ.getCell(`A${r}`).value = label;
    if (key === 'revenue_krw') {
      sQ.getCell(`B${r}`).value = revKrw;
    } else {
      sQ.getCell(`B${r}`).value = q[key] ?? '';
    }
    r++;
  }
  sQ.getCell(`A${r + 1}`).value = `* 적용 환율: ${FX_2026} (INR→KRW, 2026)`;
  sQ.getCell(`A${r + 1}`).font = { italic: true, color: { argb: 'FF64748B' } };

  // === 시트 3: 주간업무 ===
  const sW = wb.addWorksheet('주간업무');
  sW.columns = [{ width: 10 }, { width: 80 }];
  sW.getCell('A1').value = `${year}년 ${month}월 주간업무`;
  sW.getCell('A1').font = titleFont;
  sW.mergeCells('A1:B1');
  const hdrW = sW.getRow(3);
  hdrW.getCell(1).value = '주차';
  hdrW.getCell(2).value = '내용';
  hdrW.eachCell(c => { c.fill = headerFill; c.font = headerFont; });
  r = 4;
  const tasks = Array.isArray(row.weekly_tasks) ? row.weekly_tasks : [];
  const byWeek = new Map(tasks.map((t) => [t.week, t.content]));
  for (let w = 1; w <= 5; w++) {
    sW.getCell(`A${r}`).value = `${w}주차`;
    const cell = sW.getCell(`B${r}`);
    cell.value = byWeek.get(w) || '';
    cell.alignment = { wrapText: true, vertical: 'top' };
    sW.getRow(r).height = 60;
    r++;
  }

  // 파일 생성
  const buf = await wb.xlsx.writeBuffer();
  const filename = `만누르공장_${year}_${String(month).padStart(2, '0')}월_경영실적.xlsx`;

  // file_status 업데이트
  await supabaseAdmin
    .from('management_reports')
    .update({
      file_status: {
        ...(row.file_status || {}),
        excel: {
          generated_at: new Date().toISOString(),
          filename,
          size: buf.byteLength,
        },
      },
    })
    .eq('year', year).eq('month', month);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', String(buf.byteLength));
  return res.send(Buffer.from(buf));
}
