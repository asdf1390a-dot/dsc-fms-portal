import React from 'react';
import Button from '../ui/Button';

const CSV_HEADERS = [
  'metric_date',
  'total_backups',
  'successful_backups',
  'failed_backups',
  'skipped_backups',
  'total_size_bytes',
  'average_duration_seconds',
  'max_duration_seconds',
];

function escape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => escape(r[h])).join(','));
  }
  return lines.join('\n');
}

/**
 * DownloadCSVButton — exports daily metrics rows to CSV via Blob.
 *
 * Props:
 *   rows: array of backup_metrics rows
 *   filename?: string
 *   disabled?: bool
 */
export default function DownloadCSVButton({
  rows = [],
  filename = `backup-metrics-${new Date().toISOString().slice(0, 10)}.csv`,
  disabled = false,
}) {
  const handleClick = () => {
    if (!rows || rows.length === 0) return;
    const csv = toCsv(rows);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={handleClick}
      disabled={disabled || rows.length === 0}
    >
      CSV 다운로드 ({rows.length}행)
    </Button>
  );
}
