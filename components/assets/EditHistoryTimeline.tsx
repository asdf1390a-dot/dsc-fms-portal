'use client';

import type { EditHistoryEntry } from '@/app/api/assets/[assetId]/details/route';

interface Props {
  entries: EditHistoryEntry[];
  available: boolean;
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function displayVal(v: string | null): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

export default function EditHistoryTimeline({ entries, available }: Props) {
  if (!available) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Edit history table not yet provisioned. Run{' '}
        <code className="px-1 py-0.5 bg-yellow-100 rounded">
          db/46_asset_master_phase3_schema.sql
        </code>{' '}
        in Supabase SQL Editor to enable the timeline.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
        No edit history recorded for this asset yet.
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-gray-200 ml-3">
      {entries.map((e) => (
        <li key={e.id} className="ml-6 mb-6">
          <span className="absolute -left-2 flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full ring-4 ring-white" />
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {e.field_name}
              </span>
              <time className="text-xs text-gray-500">{fmt(e.changed_at)}</time>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <span className="text-gray-500">From </span>
              <span className="font-mono bg-red-50 px-1 rounded">{displayVal(e.old_value)}</span>
              <span className="text-gray-500"> → </span>
              <span className="font-mono bg-green-50 px-1 rounded">{displayVal(e.new_value)}</span>
            </div>
            {e.note && <p className="mt-2 text-xs text-gray-500">{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
