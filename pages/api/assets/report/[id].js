// ────────────────────────────────────────────────────────────────────────
// GET /api/assets/report/:id   (id = machine_asset_number)
// 취득완료보고서 HTML 출력 (브라우저 print → PDF).
//
// 양식 기준: 자산번호 / 자산명 / 구입처 / 구입가격 / 취득구분 / 사진
// ────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from '../../../../lib/supabase-admin';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtINR(n) {
  if (n == null || isNaN(Number(n))) return '';
  return '₹' + Number(n).toLocaleString('en-IN');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id_required' });

  const { data: asset, error } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('machine_asset_number', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!asset) return res.status(404).json({ error: 'not_found' });

  // 카테고리/클래스 조회
  let klass = null, category = null;
  if (asset.asset_class_code) {
    const { data: cl } = await supabaseAdmin
      .from('asset_classes').select('*').eq('code', asset.asset_class_code).maybeSingle();
    klass = cl;
    if (cl?.category_code) {
      const { data: cat } = await supabaseAdmin
        .from('categories').select('*').eq('code', cl.category_code).maybeSingle();
      category = cat;
    }
  }

  // extra에서 구입처/구입가격/취득구분 추출
  const extra = asset.extra || {};
  const vendor = extra.vendor || extra.supplier || extra.구입처 || '';
  const price  = extra.price  || extra.purchase_price || extra.구입가격 || extra.acquisition_cost || '';
  const acqKind = extra.acquisition_type || extra.취득구분 || (asset.year_of_manufacture ? '신규구매' : '');
  const acqDate = extra.acquisition_date || extra.취득일 || asset.created_at || '';
  const photos = Array.isArray(asset.photos) ? asset.photos : [];
  const docNo = String(asset.id || '').slice(0, 8).toUpperCase();

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>취득완료보고서 - ${esc(asset.machine_asset_number)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
      color: #111; margin: 0; padding: 16px; background: #f3f4f6;
    }
    .sheet { max-width: 800px; margin: 0 auto; background: #fff; padding: 28px 32px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    h1 { text-align: center; font-size: 22px; letter-spacing: 8px; margin: 0 0 6px; font-weight: 800; }
    .doc-meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #111; padding: 7px 9px; font-size: 12px; vertical-align: middle; text-align: left; }
    th { background: #eef2f7; font-weight: 700; text-align: center; width: 18%; }
    .big { font-size: 14px; font-weight: 700; }
    .right { text-align: right; font-family: ui-monospace, Consolas, monospace; }
    .center { text-align: center; }
    .long-row td { min-height: 56px; height: 56px; vertical-align: top; white-space: pre-wrap; line-height: 1.55; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
    .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border: 1px solid #ddd; }
    .approval { margin-top: 18px; }
    .approval th { height: 22px; padding: 4px; font-size: 11px; }
    .approval td { height: 70px; }
    .toolbar { max-width: 800px; margin: 0 auto 14px; display: flex; gap: 8px; justify-content: flex-end; }
    .btn-print { padding: 10px 18px; background: #0f172a; color: #fff; border: none;
      border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-back { padding: 10px 14px; background: #e5e7eb; color: #0f172a; text-decoration: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; padding: 0; max-width: none; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a class="btn-back" href="/assets/${esc(asset.machine_asset_number)}">← 돌아가기</a>
    <button class="btn-print" onclick="window.print()">🖨 인쇄 / PDF 저장</button>
  </div>
  <div class="sheet">
    <h1>취득완료보고서</h1>
    <div class="doc-meta">
      <span>분류: ${esc(category ? category.name_en : '')}</span>
      <span>문서번호: ${esc(docNo)}</span>
      <span>발행일: ${esc(fmtDate(new Date().toISOString()))}</span>
    </div>

    <table>
      <tr>
        <th>자산번호</th><td class="big">${esc(asset.machine_asset_number)}</td>
        <th>자산코드</th><td>${esc(asset.machine_asset_code || '')}</td>
      </tr>
      <tr>
        <th>자 산 명</th><td class="big" colspan="3">
          ${esc(asset.name_en)}${asset.name_ta ? ' / ' + esc(asset.name_ta) : ''}
        </td>
      </tr>
      <tr>
        <th>분  류</th>
        <td colspan="3">
          ${esc(klass ? `${klass.code} · ${klass.name_en}` : asset.asset_class_code || '')}
        </td>
      </tr>
      <tr>
        <th>모델</th><td>${esc(asset.model || '')}</td>
        <th>제조사</th><td>${esc(asset.make || '')}</td>
      </tr>
      <tr>
        <th>시리얼NO</th><td>${esc(asset.serial_no || '')}</td>
        <th>제조년도</th><td class="center">${esc(asset.year_of_manufacture || '')}</td>
      </tr>
      <tr>
        <th>설치위치</th><td colspan="3">${esc(asset.location || '')}</td>
      </tr>
    </table>

    <!-- 취득 정보 -->
    <table>
      <tr>
        <th>취득구분</th><td>${esc(acqKind || '신규구매')}</td>
        <th>취득일</th><td class="center">${esc(fmtDate(acqDate))}</td>
      </tr>
      <tr>
        <th>구입처</th><td colspan="3">${esc(vendor)}</td>
      </tr>
      <tr>
        <th>구입가격</th>
        <td class="right big" colspan="3">
          ${price ? esc(fmtINR(price)) : ''}
        </td>
      </tr>
    </table>

    ${asset.remark ? `
    <table>
      <tr class="long-row">
        <th>비  고</th>
        <td colspan="3">${esc(asset.remark)}</td>
      </tr>
    </table>` : ''}

    ${photos.length ? `
    <div style="margin-top:10px; font-size:12px; font-weight:700;">첨부 사진 (${photos.length})</div>
    <div class="photos">
      ${photos.slice(0, 6).map(p => `<img src="${esc(p)}" alt="">`).join('')}
    </div>` : ''}

    <!-- 결재 -->
    <div class="approval">
      <table>
        <tr>
          <th>신청자</th><th>사용부서장</th><th>관리부서장</th><th>대표이사</th>
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
