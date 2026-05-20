#!/usr/bin/env node
/**
 * generate-qr-bulk.js
 *
 * 506+ 자산 QR 코드 일괄 생성 스크립트
 *
 * 기능:
 *   - Supabase assets 테이블에서 qr_payload 조회
 *   - PNG + SVG 동시 생성 (병렬 처리)
 *   - Supabase Storage 업로드 (public/qr-codes/{machine_asset_number}.png)
 *   - DB qr_payload 검증 및 누락분 보고
 *
 * 옵션:
 *   --out-dir    로컬 출력 폴더 (default: /tmp/dsc-qr-output)
 *   --concurrency 병렬 처리 수 (default: 20)
 *   --only-new   기존 QR 파일 건너뛰기 (default: false)
 *   --upload     Supabase Storage에 업로드 (default: false)
 *   --format     png|svg|both (default: png)
 *   --filter-class  major class prefix 필터 (예: "09" → JIG만)
 *
 * 사용 예:
 *   node scripts/generate-qr-bulk.js --out-dir /tmp/dsc-qr --concurrency 30 --upload
 *   node scripts/generate-qr-bulk.js --filter-class 09 --format both
 *
 * 2026-05-19 | DSC Mannur QR 자동화
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');

// ── 환경 설정 ─────────────────────────────────────────────────────────────

require('dotenv').config({
  path: path.join(__dirname, '..', '.env.local'),
  override: false,
});

// Fallback: supabase.env
const secretsEnv = path.join(process.env.HOME, '.config', 'dsc-fms-secrets', 'supabase.env');
if (fs.existsSync(secretsEnv)) {
  const envContent = fs.readFileSync(secretsEnv, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^export\s+([A-Z_]+)="?([^"]+)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CLI 파싱 ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    outDir: '/tmp/dsc-qr-output',
    concurrency: 20,
    onlyNew: false,
    upload: false,
    format: 'png',
    filterClass: null,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir' && argv[i + 1]) opts.outDir = argv[++i];
    else if (a === '--concurrency' && argv[i + 1]) opts.concurrency = parseInt(argv[++i], 10);
    else if (a === '--only-new') opts.onlyNew = true;
    else if (a === '--upload') opts.upload = true;
    else if (a === '--format' && argv[i + 1]) opts.format = argv[++i];
    else if (a === '--filter-class' && argv[i + 1]) opts.filterClass = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// ── QR 옵션 ───────────────────────────────────────────────────────────────

const QR_PNG_OPTS = {
  errorCorrectionLevel: 'M',  // Medium — 데이터 복구 15%
  type: 'png',
  width: 300,                 // 300x300 px (인쇄 최적화)
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
};

const QR_SVG_OPTS = {
  errorCorrectionLevel: 'M',
  type: 'svg',
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
};

// ── Supabase 자산 조회 ────────────────────────────────────────────────────

async function fetchAssets(filterClass) {
  console.log('자산 목록 조회 중...');
  const allAssets = [];
  const PAGE = 1000;

  let offset = 0;
  while (true) {
    let query = supabase
      .from('assets')
      .select('id, machine_asset_number, machine_asset_code, asset_class_code, qr_payload, name_en, status')
      .order('machine_asset_code', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (filterClass) {
      query = query.like('asset_class_code', `${filterClass}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allAssets.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`총 ${allAssets.length}개 자산 조회 완료`);
  return allAssets;
}

// ── 단일 QR 생성 ──────────────────────────────────────────────────────────

async function generateQR(asset, outDir, opts) {
  const payload = asset.qr_payload || asset.machine_asset_number;
  if (!payload) {
    return { asset_id: asset.id, code: asset.machine_asset_number, status: 'skip', reason: 'qr_payload 없음' };
  }

  const safeName = payload.replace(/[^A-Za-z0-9\-_.]/g, '_');
  const results = [];

  try {
    if (opts.format === 'png' || opts.format === 'both') {
      const pngPath = path.join(outDir, `${safeName}.png`);
      if (opts.onlyNew && fs.existsSync(pngPath)) {
        results.push({ type: 'png', path: pngPath, status: 'skipped' });
      } else {
        const pngBuffer = await QRCode.toBuffer(payload, QR_PNG_OPTS);
        fs.writeFileSync(pngPath, pngBuffer);
        results.push({ type: 'png', path: pngPath, status: 'ok', size: pngBuffer.length });
      }
    }

    if (opts.format === 'svg' || opts.format === 'both') {
      const svgPath = path.join(outDir, `${safeName}.svg`);
      if (opts.onlyNew && fs.existsSync(svgPath)) {
        results.push({ type: 'svg', path: svgPath, status: 'skipped' });
      } else {
        const svgStr = await QRCode.toString(payload, QR_SVG_OPTS);
        fs.writeFileSync(svgPath, svgStr, 'utf8');
        results.push({ type: 'svg', path: svgPath, status: 'ok', size: Buffer.byteLength(svgStr) });
      }
    }

    return { asset_id: asset.id, code: payload, name_en: asset.name_en, status: 'ok', files: results };

  } catch (err) {
    return { asset_id: asset.id, code: payload, status: 'error', error: err.message };
  }
}

// ── Supabase Storage 업로드 ───────────────────────────────────────────────

async function uploadToStorage(asset, outDir, opts) {
  const payload = asset.qr_payload || asset.machine_asset_number;
  if (!payload) return;

  const safeName = payload.replace(/[^A-Za-z0-9\-_.]/g, '_');
  const pngPath = path.join(outDir, `${safeName}.png`);

  if (!fs.existsSync(pngPath)) return;

  const fileBuffer = fs.readFileSync(pngPath);
  const storagePath = `qr-codes/${safeName}.png`;

  const { error } = await supabase.storage
    .from('assets')
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.warn(`  업로드 실패 ${safeName}: ${error.message}`);
    return { status: 'upload_error', error: error.message };
  }

  return { status: 'uploaded', path: storagePath };
}

// ── 병렬 배치 실행 ────────────────────────────────────────────────────────

async function runBatch(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    const done = Math.min(i + concurrency, items.length);
    const pct = ((done / items.length) * 100).toFixed(1);
    process.stdout.write(`\r  진행: ${done}/${items.length} (${pct}%)`);
  }
  process.stdout.write('\n');
  return results;
}

// ── 보고서 출력 ───────────────────────────────────────────────────────────

function printReport(results, startMs, opts) {
  const ok = results.filter(r => r.status === 'ok').length;
  const skipped = results.filter(r => r.status === 'skip' || r.files?.some(f => f.status === 'skipped')).length;
  const errors = results.filter(r => r.status === 'error');

  const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
  const totalSize = results
    .filter(r => r.files)
    .flatMap(r => r.files)
    .reduce((sum, f) => sum + (f.size || 0), 0);

  console.log('\n');
  console.log('='.repeat(55));
  console.log('DSC QR 생성 결과');
  console.log('='.repeat(55));
  console.log(`총 자산:        ${results.length}`);
  console.log(`생성 완료:      ${ok}`);
  console.log(`건너뜀:         ${skipped}`);
  console.log(`오류:           ${errors.length}`);
  console.log(`총 파일 크기:   ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`처리 시간:      ${durationSec}초`);
  console.log(`출력 폴더:      ${opts.outDir}`);
  console.log(`포맷:           ${opts.format}`);
  if (opts.upload) console.log(`Storage:        업로드 완료`);
  console.log('='.repeat(55));

  if (errors.length > 0) {
    console.log('\n오류 목록:');
    for (const e of errors.slice(0, 20)) {
      console.log(`  - ${e.code}: ${e.error}`);
    }
    if (errors.length > 20) console.log(`  ... 외 ${errors.length - 20}건`);
  }

  // CSV 보고서
  const reportPath = path.join(opts.outDir, 'qr_generation_report.csv');
  const csvLines = [
    'asset_id,machine_asset_number,name_en,status,error',
    ...results.map(r =>
      `"${r.asset_id || ''}","${r.code || ''}","${(r.name_en || '').replace(/"/g, '""')}","${r.status}","${r.error || ''}"`
    ),
  ];
  fs.writeFileSync(reportPath, csvLines.join('\n'), 'utf8');
  console.log(`\n보고서 저장: ${reportPath}`);
}

// ── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  console.log('DSC Mannur QR 일괄 생성 시작');
  console.log(`  출력 폴더:    ${opts.outDir}`);
  console.log(`  병렬 처리:    ${opts.concurrency}`);
  console.log(`  포맷:         ${opts.format}`);
  console.log(`  only-new:     ${opts.onlyNew}`);
  console.log(`  upload:       ${opts.upload}`);
  if (opts.filterClass) console.log(`  class 필터:   ${opts.filterClass}`);
  if (opts.dryRun) console.log('  ** DRY RUN 모드 **');
  console.log('');

  // 출력 폴더 생성
  if (!fs.existsSync(opts.outDir)) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    console.log(`폴더 생성: ${opts.outDir}`);
  }

  const startMs = Date.now();

  // 자산 조회
  const assets = await fetchAssets(opts.filterClass);

  if (assets.length === 0) {
    console.log('조회된 자산 없음.');
    process.exit(0);
  }

  // QR 없는 자산 통계
  const noPayload = assets.filter(a => !a.qr_payload);
  if (noPayload.length > 0) {
    console.log(`\n경고: qr_payload 없는 자산 ${noPayload.length}건 (machine_asset_number 대체 사용)`);
  }

  if (opts.dryRun) {
    console.log(`\nDRY RUN: ${assets.length}개 자산 QR 생성 예정 (실제 실행 안 함)`);
    const byClass = {};
    for (const a of assets) {
      const cls = (a.asset_class_code || 'unknown').split('.')[0];
      byClass[cls] = (byClass[cls] || 0) + 1;
    }
    console.log('\n클래스별 분포:');
    for (const [cls, cnt] of Object.entries(byClass).sort()) {
      console.log(`  Class ${cls}: ${cnt}개`);
    }
    return;
  }

  // QR 생성 병렬 실행
  console.log('\nQR 코드 생성 중...');
  const qrResults = await runBatch(
    assets,
    (asset) => generateQR(asset, opts.outDir, opts),
    opts.concurrency
  );

  // Storage 업로드 (옵션)
  if (opts.upload) {
    console.log('\nStorage 업로드 중...');
    await runBatch(
      assets,
      (asset) => uploadToStorage(asset, opts.outDir, opts),
      Math.min(opts.concurrency, 10) // 업로드는 더 낮게
    );
  }

  // 보고서
  printReport(qrResults, startMs, opts);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
