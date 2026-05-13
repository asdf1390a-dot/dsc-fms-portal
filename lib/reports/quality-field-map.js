// 품질 월보고서 수치 매핑 테이블
// 전월 완성본 Excel 직접입력 셀 + 현월 raw data → 새 값
//
// 컬럼 패턴: 월(1~12) → 시트별 열 알파벳 변환
//
// 사용처: excel-processor.js
//   - getColForMonth(sheetName, monthNumber) → 'H', 'I', 'J' 등
//   - DIRECT_INPUT_CELLS: 시트별 직접입력 행 목록 (수식 셀 보호용)
//
// 데이터 추출 규칙 (Korea Report raw data):
//   - 시트명/행/열 매핑은 현장 raw data 포맷에 따라 추후 보강
//   - 현재는 안전한 기본 동작 (수치 셀 보존 + 월 표기만 교체)

// 월(1~12) → 각 시트의 컬럼 알파벳
// 월계획: H=1월, I=2월, ... S=12월 (H + month-1)
// 불량율: E=1월, F=2월, ... P=12월 (E + month-1)
// 생산효율: J=1월, K=2월, ... U=12월 (J + month-1)
// 월지표: U=1월, V=2월, ... AF=12월 (U + month-1)

const SHEET_BASE_COL = {
  '월계획':   'H',
  '불량율':   'E',
  '생산효율': 'J',
  '월지표':   'U',
};

// 알파벳 컬럼 + offset → 알파벳 컬럼 (A..AZ 지원)
function shiftCol(base, offset) {
  // Convert base letters → number
  let n = 0;
  for (const ch of base) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += offset;
  // back to letters
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function getColForMonth(sheetName, monthNumber /* 1..12 */) {
  const base = SHEET_BASE_COL[sheetName];
  if (!base) return null;
  return shiftCol(base, monthNumber - 1);
}

// 직접입력 행 범위 (수식 셀 영역과 구분)
// 보수적으로 잡아둠. 실제 raw 파싱 시 수식 여부도 함께 체크.
export const DIRECT_INPUT_ROWS = {
  '월계획':   { from: 112, to: 139 },
  '불량율':   { from: 12,  to: 22  },
  '생산효율': { from: 6,   to: 60  },
  '월지표':   { from: 6,   to: 80  },
};

// PPT/Excel 텍스트 노드의 월 표기 치환 패턴
// "2월" → "3월" 형태
export function buildMonthReplacers(prevMonth /* 1..12 */, curMonth /* 1..12 */) {
  const pairs = [];
  // "N월"
  pairs.push([new RegExp(`(?<![0-9])${prevMonth}월`, 'g'), `${curMonth}월`]);
  // "0N월" (zero-padded)
  pairs.push([new RegExp(`(?<![0-9])${String(prevMonth).padStart(2,'0')}월`, 'g'), `${String(curMonth).padStart(2,'0')}월`]);
  // "M-N월" 누계 표기는 보존 (예: 1-2월 → 1-3월 처리 필요시 별도)
  return pairs;
}

// raw data (Korea Report)에서 현월 수치를 어떻게 끌어올지는
// 시트 구조에 따라 추후 정밀화. 1차 구현은 "월 표기 교체" + "동일 셀 위치"의
// 수치를 raw data에서 같은 (시트, 행, 열)으로 찾아 덮어쓰는 best-effort.
export const RAW_DATA_HINT = {
  // raw data 측 후보 시트명 (대소문자 무시 매칭)
  candidateSheetAliases: {
    '월계획':   ['월계획', '매출', 'Sales'],
    '불량율':   ['불량율', '불량률', 'Defect'],
    '생산효율': ['생산효율', '효율', 'Efficiency'],
    '월지표':   ['월지표', '지표', 'KPI'],
  },
};
