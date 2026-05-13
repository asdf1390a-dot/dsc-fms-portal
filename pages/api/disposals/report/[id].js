// ────────────────────────────────────────────────────────────────────────
// GET /api/disposals/report/:id
// 처분신청서 HTML 출력 (브라우저 print → PDF).
//
// disposal_code 별 양식:
//   - 매각: 처분예정금액, 취득가액, 감가상각, 손익 표기
//   - 폐기: 장부금액 중심, 처분사유 강조
//   - 등록: 일반 처분 양식 (매각 기준)
//
// 출력은 양식 이미지 3종(취득완료보고서·처분신청서매각·처분신청서폐기) 기반.
// ────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from '../../../../lib/supabase-admin';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id_required' });

  const { data: row, error } = await supabaseAdmin
    .from('fixed_asset_disposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!row)  return res.status(404).json({ error: 'not_found' });

  const acq  = Number(row.acquisition_cost) || 0;
  const dep  = Number(row.accumulated_depreciation) || 0;
  const book = acq - dep;
  const disp = Number(row.disposal_amount) || 0;
  const diff = disp - book;
  const isSale  = row.disposal_code === '매각';
  const isScrap = row.disposal_code === '폐기';
  const docTitle = '고정자산 처분 신청서';
  const docNo = String(row.id).slice(0, 8).toUpperCase();
  const photos = Array.isArray(row.photos) ? row.photos : [];

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${esc(docTitle)} - ${esc(row.asset_name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
      color: #111; margin: 0; padding: 16px; background: #f3f4f6;
    }
    .sheet {
      max-width: 800px; margin: 0 auto; background: #fff; padding: 28px 32px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    h1 { text-align: center; font-size: 22px; letter-spacing: 8px; margin: 0 0 6px; font-weight: 800; }
    .doc-meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border: 1px solid #111; border-radius: 3px; font-weight: 700; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td {
      border: 1px solid #111; padding: 7px 9px; font-size: 12px; vertical-align: middle;
      text-align: left;
    }
    th { background: #eef2f7; font-weight: 700; text-align: center; width: 18%; }
    .right { text-align: right; font-family: ui-monospace, Consolas, monospace; }
    .center { text-align: center; }
    .big { font-size: 14px; font-weight: 700; }
    .num { font-family: ui-monospace, Consolas, monospace; }
    .highlight { background: #fff7ed; }
    .scrap { background: #fef2f2; }
    .profit { color: #166534; font-weight: 700; }
    .loss   { color: #b91c1c; font-weight: 700; }
    .long-row td { min-height: 56px; height: 56px; vertical-align: top; white-space: pre-wrap; line-height: 1.55; }
    .approval { margin-top: 18px; }
    .approval table { table-layout: fixed; }
    .approval th { height: 22px; padding: 4px; font-size: 11px; }
    .approval td { height: 70px; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
    .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border: 1px solid #ddd; }
    .toolbar { max-width: 800px; margin: 0 auto 14px; display: flex; gap: 8px; justify-content: flex-end; }
    .btn-print {
      padding: 10px 18px; background: #0f172a; color: #fff; border: none; border-radius: 6px;
      font-size: 14px; font-weight: 700; cursor: pointer;
    }
    .btn-back { padding: 10px 14px; background: #e5e7eb; color: #0f172a; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; padding: 0; max-width: none; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a class="btn-back" href="/disposals/${esc(row.id)}">← 돌아가기</a>
    <button class="btn-print" onclick="window.print()">🖨 인쇄 / PDF 저장</button>
  </div>
  <div class="sheet">
    <h1>${esc(docTitle)}</h1>
    <div class="doc-meta">
      <span>처분구분: <span class="pill">${esc(row.disposal_code)}</span></span>
      <span>문서번호: ${esc(docNo)}</span>
      <span>발행일: ${esc(fmtDate(new Date().toISOString()))}</span>
    </div>

    <!-- 자산 정보 -->
    <table>
      <tr>
        <th>자산번호</th><td>${esc(row.asset_no || '')}</td>
        <th>계정구분</th><td>${esc(row.account_type || '')}</td>
      </tr>
      <tr>
        <th>자 산 명</th><td class="big" colspan="3">${esc(row.asset_name)}</td>
      </tr>
      <tr>
        <th>규  격</th><td colspan="3">${esc(row.spec || '')}</td>
      </tr>
    </table>

    <!-- 처분 정보 -->
    <table>
      <tr>
        <th>처분코드</th><td><span class="pill">${esc(row.disposal_code)}</span></td>
        <th>처분수량</th><td class="right num">${esc(row.disposal_qty ?? '')}</td>
      </tr>
      ${isSale ? `
      <tr class="highlight">
        <th>처분예정금액</th><td class="right num big">${esc(fmtINR(disp))}</td>
        <th>처분예정일</th><td class="center">${esc(fmtDate(row.disposal_date))}</td>
      </tr>` : `
      <tr class="${isScrap ? 'scrap' : ''}">
        <th>처분예정일</th><td class="center">${esc(fmtDate(row.disposal_date))}</td>
        <th>처분처</th><td>${esc(row.disposal_destination || '')}</td>
      </tr>`}
      ${isSale ? `
      <tr>
        <th>매각처</th><td colspan="3">${esc(row.disposal_destination || '')}</td>
      </tr>` : ''}
    </table>

    <!-- 장부금액 -->
    <table>
      <tr>
        <th>취득가액</th><td class="right num">${esc(fmtINR(acq))}</td>
        <th>취득연도</th><td class="center">${esc(row.acquisition_year || '')}</td>
      </tr>
      <tr>
        <th>감가상각<br>총당금</th><td class="right num">${esc(fmtINR(dep))}</td>
        <th>경과년수</th><td class="center">${row.acquisition_year ? esc(new Date().getFullYear() - Number(row.acquisition_year)) + '년' : ''}</td>
      </tr>
      <tr class="highlight">
        <th>장부금액</th><td class="right num big">${esc(fmtINR(book))}</td>
        ${isSale ? `
          <th>손익</th>
          <td class="right num ${diff >= 0 ? 'profit' : 'loss'}">
            ${diff >= 0 ? '+' : ''}${esc(fmtINR(diff))} (${diff >= 0 ? '이익' : '손실'})
          </td>
        ` : `<th></th><td></td>`}
      </tr>
    </table>

    <!-- 사유 -->
    <table>
      <tr class="long-row">
        <th>처분사유<br>(사용부서)</th>
        <td colspan="3">${esc(row.disposal_reason_user || '')}</td>
      </tr>
      ${isScrap ? '' : `
      <tr class="long-row">
        <th>자재재활용<br>내용</th>
        <td colspan="3">${esc(row.material_reuse || '')}</td>
      </tr>`}
      <tr class="long-row">
        <th>검토의견<br>(집행부서)</th>
        <td colspan="3">${esc(row.review_opinion || '')}</td>
      </tr>
    </table>

    ${photos.length ? `
    <div style="margin-top:10px; font-size:12px; font-weight:700;">첨부 사진 (${photos.length})</div>
    <div class="photos">
      ${photos.slice(0, 6).map(p => `<img src="${esc(p)}" alt="">`).join('')}
    </div>` : ''}

    <!-- 결재란 -->
    <div class="approval">
      <table>
        <tr>
          <th>신청자</th><th>사용부서장</th><th>집행부서장</th><th>대표이사</th>
        </tr>
        <tr>
          <td></td><td></td><td></td><td></td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
}
