import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const T = {
  en: {
    title: 'Import Breakdowns from Excel',
    selectFile: 'Select Excel file (.xlsx)',
    import: 'Import',
    importing: 'Importing…',
    cancel: 'Cancel',
    success: 'Successfully imported {count} records',
    error: 'Import failed',
    required: 'This field is required',
    dropHint: 'Or drag and drop an Excel file here',
    onlyXlsx: 'Only .xlsx files are supported',
  },
  ko: {
    title: 'Excel에서 고장 기록 임포트',
    selectFile: 'Excel 파일 선택 (.xlsx)',
    import: '임포트',
    importing: '임포트 중…',
    cancel: '취소',
    success: '{count}개 기록이 성공적으로 임포트되었습니다',
    error: '임포트 실패',
    required: '필수 항목입니다',
    dropHint: '또는 Excel 파일을 여기에 드래그하세요',
    onlyXlsx: '.xlsx 파일만 지원합니다',
  },
};

export default function BMImportPage() {
  const router = useRouter();
  const { isAuthed, fullName, signOut } = useAuth();
  const [locale, setLocale] = useState('ko');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const t = T[locale] || T.en;

  useEffect(() => {
    if (!isAuthed) {
      router.push('/login');
    }
  }, [isAuthed, router]);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.endsWith('.xlsx')) {
        setError(t.onlyXlsx);
        return;
      }
      setFile(f);
      setError(null);
    }
  };

  const handleDragDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (!f.name.endsWith('.xlsx')) {
        setError(t.onlyXlsx);
        return;
      }
      setFile(f);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError(t.required);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/bm/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Import failed');
      }

      const data = await res.json();
      setSuccess(t.success.replace('{count}', data.imported));
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Redirect to list after 2 seconds
      setTimeout(() => {
        router.push('/bm');
      }, 2000);
    } catch (e) {
      setError(e.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthed) return null;

  return (
    <>
      <Head>
        <title>{t.title} — DSC FMS Portal</title>
      </Head>

      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{t.title}</h1>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              style={{
                padding: '8px 12px',
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '6px',
              }}
            >
              <option value="en">EN</option>
              <option value="ko">한</option>
            </select>
          </div>

          {/* Upload area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDragDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #475569',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '20px',
              background: '#1e293b',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#64748b')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#475569')}
          >
            <div style={{ fontSize: '14px', color: '#cbd5e1' }}>
              {file ? (
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>✓ {file.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{(file.size / 1024).toFixed(2)} KB</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>📁 {t.selectFile}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.dropHint}</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                background: 'rgba(220, 38, 38, 0.18)',
                border: '1px solid rgba(220, 38, 38, 0.6)',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.18)',
                border: '1px solid rgba(34, 197, 94, 0.6)',
                color: '#86efac',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              {success}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              style={{
                flex: 1,
                padding: '12px',
                background: file && !loading ? '#2563eb' : '#475569',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '6px',
                cursor: file && !loading ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background 0.2s',
              }}
            >
              {loading ? t.importing : t.import}
            </button>
            <Link href="/bm" style={{ flex: 1, textDecoration: 'none' }}>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {t.cancel}
              </button>
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
