// PPT 처리: ZIP/XML 직접 수정 방식
// - ppt/slides/slide*.xml 의 <a:t> 텍스트 노드만 교체
// - run이 분리된 경우 같은 <a:p> 내 <a:t>들을 임시 병합한 뒤 치환하고,
//   결과를 첫 <a:t>에 넣고 나머지 <a:t>는 빈 문자열로 유지 (스타일 보존)
// - 월 표기 ("N월" → "N+1월") + 숫자 치환 매핑

import JSZip from 'jszip';
import { buildMonthReplacers } from './quality-field-map.js';
import { updateRollingWindowCharts } from './rolling-window-charts.js';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function unescapeXml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

// Walk every <a:p> paragraph, gather its <a:t> runs, merge text, apply replacers,
// then re-distribute: put all replaced text in the first <a:t>, blank the rest.
// This preserves styles (a:rPr) of the first run.
function rewriteSlideXml(xml, replacers, numericMap) {
  // Match each <a:p ...>...</a:p>
  return xml.replace(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g, (paragraph) => {
    // Find all <a:t>...</a:t> within this paragraph
    const tRe = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    const matches = [];
    let m;
    while ((m = tRe.exec(paragraph)) !== null) {
      matches.push({ full: m[0], attrs: m[1] || '', text: m[2], index: m.index });
    }
    if (matches.length === 0) return paragraph;

    const merged = matches.map(x => unescapeXml(x.text)).join('');
    let replaced = merged;
    for (const [re, rep] of replacers) replaced = replaced.replace(re, rep);
    if (numericMap && Object.keys(numericMap).length) {
      for (const [k, v] of Object.entries(numericMap)) {
        // exact-token replace to avoid partial swaps
        const re = new RegExp(`(?<![0-9.])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9.])`, 'g');
        replaced = replaced.replace(re, v);
      }
    }

    if (replaced === merged) return paragraph;

    // Re-distribute: first run gets the whole replaced text, others become empty
    let out = paragraph;
    let firstReplaced = false;
    out = out.replace(tRe, (full, attrs, _text) => {
      if (!firstReplaced) {
        firstReplaced = true;
        return `<a:t${attrs || ''}>${escapeXml(replaced)}</a:t>`;
      }
      return `<a:t${attrs || ''}></a:t>`;
    });
    return out;
  });
}

/**
 * Process the monthly quality PPT report.
 * @param {Buffer} prevPptBuf
 * @param {number} prevMonth — 1..12
 * @param {number} curMonth  — 1..12
 * @param {Object<string,string>} [numericMap] — optional "oldText": "newText" map
 * @param {number} rollingWindowSize — chart data window size (default 3 months)
 * @returns {Promise<Buffer>}
 */
export async function processQualityPpt({ prevPptBuf, prevMonth, curMonth, numericMap = {}, rollingWindowSize = 3 }) {
  let zip = await JSZip.loadAsync(prevPptBuf);
  const replacers = buildMonthReplacers(prevMonth, curMonth);

  // Process all slide XMLs + slideLayouts/slideMasters (titles often there too — but they shouldn't carry monthly numbers; skip to be safe)
  const slidePaths = Object.keys(zip.files).filter(p =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p)
  );

  for (const p of slidePaths) {
    const xml = await zip.file(p).async('string');
    const newXml = rewriteSlideXml(xml, replacers, numericMap);
    if (newXml !== xml) zip.file(p, newXml);
  }

  // Notes (often contain commentary with month) — process notes slides too
  const notesPaths = Object.keys(zip.files).filter(p =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p)
  );
  for (const p of notesPaths) {
    const xml = await zip.file(p).async('string');
    const newXml = rewriteSlideXml(xml, replacers, numericMap);
    if (newXml !== xml) zip.file(p, newXml);
  }

  // Update chart data ranges for rolling window
  const tempBuf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const updatedBuf = await updateRollingWindowCharts({
    buf: tempBuf,
    prevMonth,
    curMonth,
    windowSize: rollingWindowSize,
    fileType: 'pptx',
    sheetName: '월지표',
  });

  return updatedBuf;
}
