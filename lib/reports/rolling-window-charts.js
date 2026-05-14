// 롤링 윈도우 차트 관리 모듈
// 새로운 월이 추가될 때 차트 데이터 범위가 자동으로 이동 (이전 가장 오래된 월은 제거됨)
// 예: 1월/2월/3월 → 2월/3월/4월 → 3월/4월/5월

import JSZip from 'jszip';
import { getColForMonth } from './quality-field-map.js';

// ──────────────────────────────────────────────────────────────────────
// 컬럼 헬퍼 함수
// ──────────────────────────────────────────────────────────────────────

// 컬럼 문자(들)를 숫자로 변환 (A=1, B=2, ..., Z=26, AA=27, 등)
function colToNum(col) {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
}

// 숫자를 컬럼 문자(들)로 변환
function numToCol(num) {
  let col = '';
  while (num > 0) {
    num--;
    col = String.fromCharCode(65 + (num % 26)) + col;
    num = Math.floor(num / 26);
  }
  return col;
}

// 주어진 월의 롤링 윈도우 컬럼 범위 가져오기
// windowSize: 3 = 최근 3개월, 6 = 최근 6개월, 등
// sheetName: 기준이 되는 시트명
export function getRollingWindowColumns(currentMonth /* 1..12 */, windowSize = 3, sheetName = '월지표') {
  const base = getColForMonth(sheetName, 1);
  if (!base) return null;

  const baseNum = colToNum(base);
  // 1월=U(21), 2월=V(22), ... 12월=AF(32)
  // N월의 경우, 컬럼은 base + (N-1)

  const cols = [];
  for (let i = windowSize; i >= 1; i--) {
    const month = currentMonth - i + 1;
    if (month < 1) continue; // 1월 이전 달은 건너뛰기
    const colNum = baseNum + (month - 1);
    cols.push(numToCol(colNum));
  }
  return cols; // 예: ['U', 'V', 'W'] (1월/2월/3월 윈도우)
}

// Excel 차트 XML에서 차트 데이터 범위 업데이트
// 예: "$월지표.$U$26:$U$40" → "$월지표.$V$26:$V$40" (1개월 앞으로 이동)
function updateChartDataRange(dataRange /* 예: "$월지표.$BA$26:$BC$26" */, sheetName, oldCols, newCols) {
  if (!dataRange) return dataRange;

  // 범위에 나타난 이전 컬럼을 새 컬럼으로 치환
  let updated = dataRange;
  for (let i = 0; i < oldCols.length; i++) {
    const oldCol = oldCols[i];
    const newCol = newCols[i];
    // "$COL"과 "!$COL" 패턴 모두 매칭
    const re = new RegExp(`\\$?${oldCol}(?=\\$|:)`, 'g');
    updated = updated.replace(re, newCol);
  }
  return updated;
}

// workbook.xml의 모든 차트 데이터 범위 찾기 및 업데이트 (외부 데이터 참조)
// 차트가 별도 chart*.xml 파일에 저장될 수 있으므로 복잡함
// 현재는 인라인 범위 참조를 처리
function updateWorkbookChartRefs(wbXml, sheetName, oldCols, newCols) {
  // 차트 데이터는 보통 workbook.xml에 <dataRange> 또는 <c:val><numRef><f>...</f></numRef></c:val> 형태
  // 이것은 단순화된 접근법 — 완전한 구현은 차트 XML 파싱이 필요할 수도 있음
  let updated = wbXml;
  for (let i = 0; i < oldCols.length; i++) {
    const pattern = `\\$?${oldCols[i]}(?=\\$|:|\\))`;
    const re = new RegExp(pattern, 'g');
    updated = updated.replace(re, newCols[i]);
  }
  return updated;
}

// ppt/* 또는 xl/charts/* 디렉토리의 chart*.xml 파일 업데이트
// Excel의 차트는 xl/charts/chart*.xml에 저장됨
// PPT의 차트는 ppt/charts/chart*.xml에 저장됨
async function updateChartXmlFiles(zip, chartDir /* 'xl/charts' 또는 'ppt/charts' */, sheetName, oldCols, newCols) {
  const files = Object.keys(zip.files);
  for (const path of files) {
    if (!path.startsWith(`${chartDir}/`) || !path.endsWith('.xml')) continue;

    let xml = await zip.file(path).async('string');
    // 데이터 계열 참조 업데이트
    // <c:numRef><c:f>$월지표.$U$26</c:f></c:numRef>
    for (let i = 0; i < oldCols.length; i++) {
      const pattern = `\\$?${oldCols[i]}(?=\\$|:|\\))`;
      const re = new RegExp(pattern, 'g');
      xml = xml.replace(re, newCols[i]);
    }
    zip.file(path, xml);
  }
}

// ──────────────────────────────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────────────────────────────

/**
 * Excel/PPT의 모든 차트를 롤링 윈도우 데이터 범위로 업데이트.
 * @param {Buffer} buf — xlsx 또는 pptx 버퍼
 * @param {number} prevMonth — 이전 월 (1..12)
 * @param {number} curMonth — 현재 월 (1..12)
 * @param {number} windowSize — 롤링 윈도우 크기 (기본값 3)
 * @param {string} fileType — 'xlsx' 또는 'pptx'
 * @param {string} sheetName — 월별 데이터를 포함하는 시트 (기본값 '월지표')
 * @returns {Promise<Buffer>} — 업데이트된 버퍼
 */
export async function updateRollingWindowCharts({
  buf,
  prevMonth,
  curMonth,
  windowSize = 3,
  fileType = 'xlsx',
  sheetName = '월지표',
}) {
  const zip = await JSZip.loadAsync(buf);

  const chartDir = fileType === 'xlsx' ? 'xl/charts' : 'ppt/charts';
  const oldCols = getRollingWindowColumns(prevMonth, windowSize, sheetName) || [];
  const newCols = getRollingWindowColumns(curMonth, windowSize, sheetName) || [];

  if (oldCols.length === 0 || newCols.length === 0) {
    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  // 차트 XML 파일 업데이트
  await updateChartXmlFiles(zip, chartDir, sheetName, oldCols, newCols);

  // XLSX의 경우, 시트 XML의 내장된 차트 참조도 업데이트
  if (fileType === 'xlsx') {
    const files = Object.keys(zip.files);
    for (const path of files) {
      if (!path.startsWith('xl/worksheets/') || !path.endsWith('.xml')) continue;
      let xml = await zip.file(path).async('string');
      for (let i = 0; i < oldCols.length; i++) {
        const pattern = `\\$?${oldCols[i]}(?=\\$|:|\\))`;
        const re = new RegExp(pattern, 'g');
        xml = xml.replace(re, newCols[i]);
      }
      zip.file(path, xml);
    }
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * API 응답을 위한 롤링 윈도우 메타데이터 가져오기.
 * 프론트엔드가 현재 차트 데이터 범위를 이해하는데 유용.
 */
export function getRollingWindowInfo(currentMonth, windowSize = 3, sheetName = '월지표') {
  const cols = getRollingWindowColumns(currentMonth, windowSize, sheetName);
  const months = [];
  for (let i = windowSize; i >= 1; i--) {
    const month = currentMonth - i + 1;
    if (month >= 1) months.push(month);
  }
  return {
    windowSize,
    currentMonth,
    months,
    columns: cols,
    range: cols && cols.length > 0 ? `${cols[0]}:${cols[cols.length - 1]}` : null,
  };
}
