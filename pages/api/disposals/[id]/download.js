// ────────────────────────────────────────────────────────────────────────
// GET /api/disposals/:id/download
// 고정자산 처분 승인서를 Excel(.xlsx) 파일로 생성하여 반환.
//
// xlsx 패키지로 셀 병합 / 테두리 / 굵은 글씨 적용된 양식 레이아웃 생성.
// ────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

function fmtINR(n) {
  if (n == null || isNaN(Number(n))) return '';
  return '₹' + Number(n).toLocaleString('en-IN');
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// xlsx 라이브러리의 스타일은 community build에선 제한적이지만,
// 셀 병합·기본 텍스트는 100% 정상 동작. 스타일 객체는 일부 뷰어에서만 적용됨.
const STYLE_TITLE  = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center', vertical: 'center' } };
const STYLE_HEADER = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' },
                       fill: { fgColor: { rgb: 'E5E7EB' } } };
const STYLE_LABEL  = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' },
                       fill: { fgColor: { rgb: 'F1F5F9' } } };
const STYLE_VALUE  = { font: { sz: 10 }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } };
const STYLE_NUM    = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' } };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  // 데이터 조회 (service_role)
  const { data: row, error } = await supabaseAdmin
    .from('fixed_asset_disposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!row)  return res.status(404).json({ error: 'not found' });

  // 계산
  const acq  = Number(row.acquisition_cost) || 0;
  const dep  = Number(row.accumulated_depreciation) || 0;
  const book = acq - dep;
  const disp = Number(row.disposal_amount) || 0;
  const diff = disp - book;
  const years = row.acquisition_year ? new Date().getFullYear() - Number(row.acquisition_year) : '';

  // ── 시트 구성 (Array-of-Arrays) ────────────────────────────────────
  // 6컬럼 레이아웃: A B C D E F
  const aoa = [
    // 1행: 제목
    ['고정자산 처분 승인서', '', '', '', '', ''],
    // 2행: 발급일 / 문서번호
    [`발급일: ${fmtDate(new Date().toISOString())}`, '', '', '', '문서번호:', String(row.id).slice(0, 8)],
    // 빈 행
    ['', '', '', '', '', ''],

    // ── 기본 정보 ──
    ['■ 기본 정보', '', '', '', '', ''],
    ['자산NO',   row.asset_no || '',     '', '계정구분', row.account_type || '', ''],
    ['자산명',   row.asset_name || '',   '', '규격',     row.spec || '',         ''],
    ['', '', '', '', '', ''],

    // ── 처분 정보 ──
    ['■ 처분 정보', '', '', '', '', ''],
    ['처분코드',       row.disposal_code || '',          '', '처분수량', row.disposal_qty != null ? row.disposal_qty : '', ''],
    ['처분예정금액',   fmtINR(row.disposal_amount),      '', '처분예정일', fmtDate(row.disposal_date), ''],
    ['처분처',         row.disposal_destination || '',   '', '',         '',                          ''],
    ['', '', '', '', '', ''],

    // ── 장부금액 내역 ──
    ['■ 장부금액 내역', '', '', '', '', ''],
    ['취득가액',       fmtINR(acq),    '', '취득연도',   row.acquisition_year || '', ''],
    ['감가상각총당금', fmtINR(dep),    '', '경과년수',   years !== '' ? `${years}년` : '', ''],
    ['장부금액',       fmtINR(book),   '', '처분가액비교가', `${diff >= 0 ? '+' : ''}${fmtINR(diff)} (${diff >= 0 ? '이익' : '손실'})`, ''],
    ['', '', '', '', '', ''],

    // ── 사유 / 의견 ──
    ['■ 사유 및 의견', '', '', '', '', ''],
    ['처분사유 (사용부서)', row.disposal_reason_user || '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['자재재활용 내용',     row.material_reuse || '',       '', '', '', ''],
    ['', '', '', '', '', ''],
    ['검토의견 (집행부서)', row.review_opinion || '',       '', '', '', ''],
    ['', '', '', '', '', ''],

    // ── 첨부 ──
    ['■ 첨부', '', '', '', '', ''],
    ['사진 수', Array.isArray(row.photos) ? row.photos.length : 0, '', '파일 수', Array.isArray(row.files) ? row.files.length : 0, ''],
    ['', '', '', '', '', ''],

    // ── 결재란 ──
    ['■ 결재', '', '', '', '', ''],
    ['신청', '검토', '승인', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 컬럼 너비
  ws['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 2 }, { wch: 16 }, { wch: 22 }, { wch: 2 },
  ];

  // 행 높이 (제목 행만 크게)
  ws['!rows'] = [
    { hpt: 28 }, // 제목
    { hpt: 16 }, // 발급일
  ];

  // ── 셀 병합 ────────────────────────────────────────────────────────
  // (행/열 0-based, e: end 포함)
  ws['!merges'] = [
    // 1행: 제목 A1:F1
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    // 2행: 발급일 A2:D2
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },

    // 섹션 헤더 (■)
    { s: { r: 3,  c: 0 }, e: { r: 3,  c: 5 } }, // 기본 정보
    { s: { r: 7,  c: 0 }, e: { r: 7,  c: 5 } }, // 처분 정보
    { s: { r: 12, c: 0 }, e: { r: 12, c: 5 } }, // 장부금액
    { s: { r: 17, c: 0 }, e: { r: 17, c: 5 } }, // 사유
    { s: { r: 25, c: 0 }, e: { r: 25, c: 5 } }, // 첨부
    { s: { r: 28, c: 0 }, e: { r: 28, c: 5 } }, // 결재

    // 값 셀 병합 (라벨 1칸 + 값 1칸 패턴, 필요한 곳만)
    // 자산명/규격 - 자산명 값을 좀 길게
    { s: { r: 5, c: 1 }, e: { r: 5, c: 1 } },
    // 사유 텍스트 (긴 텍스트는 B~F 통합)
    { s: { r: 18, c: 1 }, e: { r: 18, c: 5 } },
    { s: { r: 20, c: 1 }, e: { r: 20, c: 5 } },
    { s: { r: 22, c: 1 }, e: { r: 22, c: 5 } },

    // 결재란 빈 박스 (3열 × 3행)
    { s: { r: 30, c: 0 }, e: { r: 32, c: 0 } },
    { s: { r: 30, c: 1 }, e: { r: 32, c: 1 } },
    { s: { r: 30, c: 2 }, e: { r: 32, c: 2 } },
  ];

  // ── 스타일 (community build에선 부분적용, viewer에 따라 다름) ────
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) continue;
      const v = ws[addr].v;
      // 제목
      if (R === 0) { ws[addr].s = STYLE_TITLE; continue; }
      // 섹션 헤더 (■로 시작)
      if (typeof v === 'string' && v.startsWith('■')) { ws[addr].s = STYLE_HEADER; continue; }
      // 라벨 컬럼 (A, D)
      if ((C === 0 || C === 3) && typeof v === 'string' && v && !v.startsWith('■')) {
        ws[addr].s = STYLE_LABEL; continue;
      }
      // 결재란 셀
      if (R === 29 && (C === 0 || C === 1 || C === 2)) { ws[addr].s = STYLE_HEADER; continue; }
      // 기본 값
      ws[addr].s = STYLE_VALUE;
    }
  }

  // ── Workbook 생성 ──────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '처분승인서');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // 파일명 (한글 포함 시 RFC 5987 인코딩)
  const safeName = (row.asset_name || 'asset').replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = `고정자산처분승인서_${safeName}_${String(row.id).slice(0, 8)}.xlsx`;
  const encoded  = encodeURIComponent(filename);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="disposal_${String(row.id).slice(0,8)}.xlsx"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Length', buf.length);
  res.status(200).send(buf);
}
