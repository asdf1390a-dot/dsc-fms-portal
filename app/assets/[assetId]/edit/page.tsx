'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Asset } from '@/lib/assets/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STATUS_OPTIONS = ['active', 'idle', 'maintenance', 'sold', 'scrapped'] as const;

type FormState = {
  asset_class_code: string;
  machine_asset_number: string;
  serial_no: string;
  name_en: string;
  name_ta: string;
  model: string;
  make: string;
  year_of_manufacture: string;
  location: string;
  status: typeof STATUS_OPTIONS[number];
  remark: string;
};

function emptyForm(): FormState {
  return {
    asset_class_code: '',
    machine_asset_number: '',
    serial_no: '',
    name_en: '',
    name_ta: '',
    model: '',
    make: '',
    year_of_manufacture: '',
    location: '',
    status: 'active',
    remark: '',
  };
}

function assetToForm(a: Asset): FormState {
  return {
    asset_class_code: a.asset_class_code ?? '',
    machine_asset_number: a.machine_asset_number ?? '',
    serial_no: a.serial_no ?? '',
    name_en: a.name_en ?? '',
    name_ta: a.name_ta ?? '',
    model: a.model ?? '',
    make: a.make ?? '',
    year_of_manufacture: a.year_of_manufacture != null ? String(a.year_of_manufacture) : '',
    location: a.location ?? '',
    status: (a.status as FormState['status']) ?? 'active',
    remark: a.remark ?? '',
  };
}

export default function AssetEditPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = (params?.assetId as string) || '';

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/assets/${assetId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        setForm(assetToForm(json.data as Asset));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load asset');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function validate(): { ok: true } | { ok: false; field: string; message: string } {
    if (!form.name_en.trim()) return { ok: false, field: 'name_en', message: 'Name (EN) is required' };
    if (form.name_en.length > 100) return { ok: false, field: 'name_en', message: 'Name (EN) must be ≤100 chars' };
    if (!form.asset_class_code.trim()) return { ok: false, field: 'asset_class_code', message: 'Asset class is required' };
    if (!form.location.trim()) return { ok: false, field: 'location', message: 'Location is required' };
    if (form.year_of_manufacture.trim()) {
      const y = Number(form.year_of_manufacture);
      if (!Number.isInteger(y) || y < 1950 || y > 2026) {
        return { ok: false, field: 'year_of_manufacture', message: 'Year must be 1950–2026' };
      }
    }
    if (!STATUS_OPTIONS.includes(form.status)) {
      return { ok: false, field: 'status', message: 'Invalid status' };
    }
    return { ok: true };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setSuccess(null);

    const v = validate();
    if (!v.ok) {
      setFieldError({ field: v.field, message: v.message });
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('You must be signed in to edit. Please log in and retry.');
        setSaving(false);
        return;
      }

      const payload: Record<string, any> = {
        asset_class_code: form.asset_class_code.trim(),
        machine_asset_number: form.machine_asset_number.trim(),
        serial_no: form.serial_no.trim() || null,
        name_en: form.name_en.trim(),
        name_ta: form.name_ta.trim() || null,
        model: form.model.trim() || null,
        make: form.make.trim() || null,
        year_of_manufacture: form.year_of_manufacture.trim()
          ? Number(form.year_of_manufacture)
          : null,
        location: form.location.trim(),
        status: form.status,
        remark: form.remark.trim() || null,
      };

      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json?.error?.field) {
          setFieldError({ field: json.error.field, message: json.error.message });
        } else {
          setError(json?.error?.message || `HTTP ${res.status}`);
        }
        setSaving(false);
        return;
      }

      setSuccess('Saved');
      setTimeout(() => {
        router.push(`/assets/${assetId}`);
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href={`/assets/${assetId}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Detail
          </Link>
          <span className="text-xs text-gray-500 font-mono">{assetId}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Asset</h1>

        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            Loading…
          </div>
        )}

        {!loading && error && !saving && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            {success} — redirecting…
          </div>
        )}

        {!loading && (
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Info */}
            <section className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput
                  label="Name (EN) *"
                  value={form.name_en}
                  onChange={(v) => update('name_en', v)}
                  error={fieldError?.field === 'name_en' ? fieldError.message : undefined}
                />
                <FieldInput
                  label="Name (TA)"
                  value={form.name_ta}
                  onChange={(v) => update('name_ta', v)}
                />
                <FieldInput
                  label="Asset Class Code *"
                  value={form.asset_class_code}
                  onChange={(v) => update('asset_class_code', v)}
                  error={fieldError?.field === 'asset_class_code' ? fieldError.message : undefined}
                />
                <FieldInput
                  label="Physical Tag (Machine #)"
                  value={form.machine_asset_number}
                  onChange={(v) => update('machine_asset_number', v)}
                  error={fieldError?.field === 'machine_asset_number' ? fieldError.message : undefined}
                />
                <FieldInput
                  label="Location *"
                  value={form.location}
                  onChange={(v) => update('location', v)}
                  error={fieldError?.field === 'location' ? fieldError.message : undefined}
                />
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                    Status *
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => update('status', e.target.value as FormState['status'])}
                    className="w-full text-base border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {fieldError?.field === 'status' && (
                    <p className="mt-1 text-xs text-red-600">{fieldError.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Additional Details */}
            <section className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput
                  label="Make"
                  value={form.make}
                  onChange={(v) => update('make', v)}
                />
                <FieldInput
                  label="Model"
                  value={form.model}
                  onChange={(v) => update('model', v)}
                />
                <FieldInput
                  label="Serial No."
                  value={form.serial_no}
                  onChange={(v) => update('serial_no', v)}
                />
                <FieldInput
                  label="Year of Manufacture"
                  type="number"
                  value={form.year_of_manufacture}
                  onChange={(v) => update('year_of_manufacture', v)}
                  error={
                    fieldError?.field === 'year_of_manufacture' ? fieldError.message : undefined
                  }
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                  Remark
                </label>
                <textarea
                  value={form.remark}
                  onChange={(e) => update('remark', e.target.value)}
                  rows={4}
                  className="w-full text-base border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </section>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push(`/assets/${assetId}`)}
                disabled={saving}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-base border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
