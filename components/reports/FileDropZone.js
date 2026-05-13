import { useRef, useState } from 'react';

// 모바일 친화 파일 드롭존
// props: { label, subLabel, accept, file, onFile, onClear, disabled }
export default function FileDropZone({ label, subLabel, accept, file, onFile, onClear, disabled }) {
  const inputRef = useRef(null);
  const [hover, setHover] = useState(false);

  function pick() {
    if (disabled) return;
    inputRef.current?.click();
  }
  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = '';
  }
  function onDrop(e) {
    e.preventDefault();
    setHover(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  const has = !!file;
  return (
    <div
      onDragOver={e => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      onClick={pick}
      style={{
        border: `1.5px dashed ${has ? '#22c55e' : hover ? '#3b82f6' : '#475569'}`,
        background: has ? 'rgba(34,197,94,0.08)' : 'rgba(30,41,59,0.6)',
        borderRadius: 10,
        padding: '14px 14px',
        minHeight: 76,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: has ? '#22c55e' : '#334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0,
      }}>
        {has ? '✓' : '＋'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
          {label}
        </div>
        {has ? (
          <div style={{ fontSize: 11, color: '#86efac', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.name} <span style={{ color: '#64748b' }}>({Math.round(file.size / 1024)} KB)</span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{subLabel || '탭하여 파일 선택'}</div>
        )}
      </div>
      {has && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: '1px solid #475569',
            color: '#94a3b8', fontSize: 16, cursor: 'pointer', flexShrink: 0,
          }}
          aria-label="제거"
        >×</button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
