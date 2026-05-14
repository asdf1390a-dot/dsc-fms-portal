# JEEPNEY 디자인 시스템 — 상세 가이드

> **목표:** 일관되고 모던한 UI 구축  
> **대상:** 웹개발자 (구현 시 참고)  
> **기준일:** 2026-05-13

---

## 1. 색상 체계

### 1.1 기본 팔레트

```
┌─────────────────────────────────────────────────────────┐
│ DARK THEME (DEFAULT)                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Primary BG:        #0f172a  (Very Dark Slate)          │
│ Secondary BG:      #1e293b  (Dark Slate)               │
│ Card BG:           #1e293b  (Dark Slate)               │
│ Input BG:          #0f172a  (Very Dark Slate)          │
│                                                          │
│ Border:            #334155  (Slate-700)                │
│ Border Hover:      #475569  (Slate-600)                │
│                                                          │
│ Text Primary:      #f8fafc  (Slate-50)                 │
│ Text Secondary:    #cbd5e1  (Slate-400)                │
│ Text Tertiary:     #64748b  (Slate-500)                │
│ Text Disabled:     #475569  (Slate-600)                │
│                                                          │
│ Link Default:      #06b6d4  (Cyan)                     │
│ Link Hover:        #0891b2  (Cyan-600)                 │
│ Link Active:       #06a5d7  (Cyan-600)                 │
│                                                          │
│ Accent Primary:    #06b6d4  (Cyan)                     │
│ Accent Secondary:  #a78bfa  (Violet)                   │
│ Accent Tertiary:   #3b82f6  (Blue)                     │
│                                                          │
│ Success:           #10b981  (Emerald-500)              │
│ Warning:           #f59e0b  (Amber-500)                │
│ Error:             #ef4444  (Red-500)                  │
│ Info:              #3b82f6  (Blue-500)                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 색상 사용 규칙

| 요소 | 색상 | 사용처 | 예시 |
|------|------|--------|------|
| **CTA 버튼** | #06b6d4 (Cyan) | "저장", "제출", "추가" | Primary Button |
| **보조 버튼** | #334155 (Slate-700) | "취소", "돌아가기" | Secondary Button |
| **위험 버튼** | #ef4444 (Red) | "삭제", "거부" | Danger Button |
| **활성 탭** | #06b6d4 + 언더라인 | 현재 페이지 표시 | 선택된 탭 |
| **호버 상태** | Brightness -10% | 버튼/링크 호버 | 마우스 올렸을 때 |
| **에러 메시지** | #ef4444 (Red) | 입력 검증 오류 | "필수 항목입니다" |
| **성공 메시지** | #10b981 (Emerald) | 완료/저장 확인 | "저장되었습니다" |
| **경고** | #f59e0b (Amber) | 주의 필요 | "만료 예정" |
| **정보** | #3b82f6 (Blue) | 안내 메시지 | "새로운 항목 있음" |

### 1.3 CSS 변수 정의

```css
/* lib/design-tokens.js 또는 globals.css */
:root {
  /* Colors */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-card: #1e293b;
  --color-bg-input: #0f172a;
  
  --color-border: #334155;
  --color-border-hover: #475569;
  
  --color-text-primary: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-tertiary: #64748b;
  --color-text-disabled: #475569;
  
  --color-link: #06b6d4;
  --color-link-hover: #0891b2;
  
  --color-accent-primary: #06b6d4;
  --color-accent-secondary: #a78bfa;
  --color-accent-tertiary: #3b82f6;
  
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;
  --space-4xl: 40px;
  
  /* Typography */
  --font-family-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                      "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
  --font-family-mono: "Menlo", "Monaco", "Courier New", monospace;
  
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 32px;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 2. 타이포그래피

### 2.1 폰트 로딩

```jsx
// pages/_document.js
import { Inter, Noto_Sans_KR } from '@next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['korean'],
  weight: ['400', '500', '600', '700'],
});

export default function Document() {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansKr.variable}`}>
      {/* ... */}
    </html>
  );
}
```

### 2.2 텍스트 스타일 정의

```css
/* components/ui/Typography.css */

/* Heading 1 - 32px, bold */
.heading-1 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

/* Heading 2 - 24px, semibold */
.heading-2 {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.2px;
}

/* Heading 3 - 20px, semibold */
.heading-3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}

/* Heading 4 - 16px, semibold */
.heading-4 {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

/* Body - 14px, normal */
.body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
}

/* Body Small - 12px, normal */
.body-small {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}

/* Label - 11px, semibold */
.label {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Button - 14px, semibold */
.button-text {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

/* Caption - 12px, normal, muted */
.caption {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--color-text-tertiary);
}

/* Code - monospace */
.code {
  font-family: var(--font-family-mono);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}
```

---

## 3. 컴포넌트 설계 명세

### 3.1 Button 컴포넌트

```jsx
// components/ui/Button.js

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  className,
  ...props
}) {
  const variants = {
    primary: {
      bg: '#06b6d4',
      text: '#ffffff',
      hover: '#0891b2',
    },
    secondary: {
      bg: '#334155',
      text: '#f8fafc',
      hover: '#475569',
    },
    danger: {
      bg: '#ef4444',
      text: '#ffffff',
      hover: '#dc2626',
    },
    ghost: {
      bg: 'transparent',
      text: '#f8fafc',
      border: '1px solid #334155',
      hover: { border: '1px solid #475569' },
    },
  };

  const sizes = {
    sm: { height: 32, padding: '0 12px', fontSize: 12 },
    md: { height: 40, padding: '0 16px', fontSize: 14 },
    lg: { height: 48, padding: '0 20px', fontSize: 14 },
  };

  const style = {
    ...sizes[size],
    ...variants[variant],
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  return (
    <button style={style} disabled={disabled} onClick={onClick} {...props}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
```

### 3.2 Card 컴포넌트

```jsx
// components/ui/Card.js

export default function Card({
  children,
  header,
  footer,
  hoverable = false,
  className,
  ...props
}) {
  const style = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    transition: hoverable ? 'all 200ms' : 'none',
    cursor: hoverable ? 'pointer' : 'default',
  };

  return (
    <div style={style} {...props}>
      {header && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {header}
        </div>
      )}

      <div style={{ padding: '16px' }}>
        {children}
      </div>

      {footer && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
```

### 3.3 Input 컴포넌트

```jsx
// components/ui/Input.js

export default function Input({
  label,
  placeholder,
  type = 'text',
  error,
  helperText,
  value,
  onChange,
  disabled = false,
  required = false,
  ...props
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <label style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#cbd5e1',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {label}
          {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          fontSize: 14,
          padding: '10px 12px',
          background: '#0f172a',
          color: '#f8fafc',
          border: `1px solid ${error ? '#ef4444' : '#334155'}`,
          borderRadius: 6,
          outline: 'none',
          transition: 'all 200ms',
          '::placeholder': { color: '#64748b' },
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? '#ef4444' : '#06b6d4';
          e.target.style.boxShadow = `0 0 0 3px rgba(6, 182, 212, 0.1)`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#ef4444' : '#334155';
          e.target.style.boxShadow = 'none';
        }}
        {...props}
      />

      {(error || helperText) && (
        <span style={{
          fontSize: 11,
          color: error ? '#ef4444' : '#cbd5e1',
        }}>
          {error || helperText}
        </span>
      )}
    </div>
  );
}
```

### 3.4 Tab 컴포넌트

```jsx
// components/ui/TabNav.js

export default function TabNav({ tabs, activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid #334155',
      overflowX: 'auto',
      scrollBehavior: 'smooth',
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: activeTab === tab.id ? 600 : 500,
            color: activeTab === tab.id ? '#06b6d4' : '#cbd5e1',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #06b6d4' : 'none',
            cursor: 'pointer',
            transition: 'all 200ms',
            whiteSpace: 'nowrap',
            ':hover': {
              color: '#f8fafc',
            },
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

### 3.5 Modal 컴포넌트

```jsx
// components/ui/Modal.js

export default function Modal({
  isOpen,
  title,
  children,
  onClose,
  footer,
  size = 'md', // 'sm' | 'md' | 'lg'
}) {
  if (!isOpen) return null;

  const sizes = {
    sm: { maxWidth: '320px' },
    md: { maxWidth: '480px' },
    lg: { maxWidth: '720px' },
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1e293b',
          borderRadius: 12,
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: sizes[size].maxWidth,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {title && (
          <div style={{
            padding: 20,
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontSize: 24,
              }}
            >
              ×
            </button>
          </div>
        )}

        <div style={{ padding: 20 }}>
          {children}
        </div>

        {footer && (
          <div style={{
            padding: 20,
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 4. 레이아웃 그리드

### 4.1 반응형 브레이크포인트

```javascript
// lib/breakpoints.js
const breakpoints = {
  mobile: 0,      // 0px ~ 639px
  tablet: 640,    // 640px ~ 1023px
  desktop: 1024,  // 1024px ~ 1279px
  wide: 1280,     // 1280px+
};

export const mediaQuery = {
  mobile: `@media (max-width: ${breakpoints.tablet - 1}px)`,
  tablet: `@media (min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`,
  desktop: `@media (min-width: ${breakpoints.desktop}px)`,
  wide: `@media (min-width: ${breakpoints.wide}px)`,
};
```

### 4.2 컨테이너 너비

```javascript
const containerWidths = {
  mobile: 'calc(100% - 24px)',  // padding: 12px both sides
  tablet: '600px',
  desktop: '960px',
  wide: '1280px',
};

// 사용 예시
const containerStyle = {
  maxWidth: containerWidths.desktop,
  margin: '0 auto',
  padding: '0 12px', // 모바일
};
```

### 4.3 그리드 시스템 (12열)

```css
/* 12-column grid */
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}

.col-1 { grid-column: span 1; }
.col-2 { grid-column: span 2; }
.col-3 { grid-column: span 3; }
.col-4 { grid-column: span 4; }
.col-6 { grid-column: span 6; }
.col-12 { grid-column: span 12; }

/* 반응형 */
@media (max-width: 639px) {
  .grid-12 { grid-template-columns: repeat(6, 1fr); }
  .col-4 { grid-column: span 6; }
  .col-6 { grid-column: span 6; }
}
```

---

## 5. 아이콘 가이드

### 5.1 Heroicons 사용

```jsx
// components/icons/HeroIcon.js
export function HomeIcon({ className = '' }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
```

### 5.2 아이콘 크기 및 색상

```javascript
// 크기
const iconSizes = {
  xs: 16,    // 작은 배지, 인라인
  sm: 20,    // 버튼 내부 아이콘
  md: 24,    // 기본 아이콘
  lg: 32,    // 헤더, 대형 버튼
  xl: 48,    // 영웅 섹션
};

// 색상 (currentColor 사용으로 상속)
const iconColors = {
  default: 'currentColor', // 부모 텍스트 색상 상속
  primary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  muted: '#64748b',
};
```

---

## 6. 상태 & 피드백

### 6.1 로딩 상태

```jsx
// components/ui/Spinner.js
export default function Spinner({ size = 'md' }) {
  const sizes = { sm: 16, md: 24, lg: 32 };
  
  return (
    <svg
      width={sizes[size]}
      height={sizes[size]}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        animation: 'spin 1s linear infinite',
        color: '#06b6d4',
      }}
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// CSS 애니메이션
const styles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
```

### 6.2 토스트 메시지

```jsx
// components/ui/Toast.js
export default function Toast({ message, type = 'info', autoClose = 3000 }) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      padding: '12px 16px',
      background: '#1e293b',
      borderLeft: `4px solid ${colors[type]}`,
      borderRadius: 6,
      color: '#f8fafc',
      fontSize: 14,
      boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)',
      zIndex: 100,
      animation: 'slideIn 300ms ease-out',
    }}>
      {message}
    </div>
  );
}
```

### 6.3 에러 상태

```jsx
// 입력 필드 에러
<Input
  label="Email"
  error="Invalid email format"
  helperText="Please use a valid email address"
/>

// 페이지 레벨 에러
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

---

## 7. 애니메이션 & 트랜지션

### 7.1 트랜지션 타이밍

```javascript
const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',   // UI 상호작용
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',   // 기본
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',   // 페이지 전환
  slowest: '500ms cubic-bezier(0.4, 0, 0.2, 1)', // 모달, 사이드바
};
```

### 7.2 주요 애니메이션

```css
/* Fade in/out */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Slide up (모바일 메뉴) */
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Slide down */
@keyframes slideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Scale (호버) */
@keyframes scaleUp {
  from { transform: scale(1); }
  to { transform: scale(1.02); }
}
```

### 7.3 페이지 전환 효과

```jsx
// pages/_app.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  
  useEffect(() => {
    const handleRouteChange = () => {
      // 페이드 아웃 효과
      document.documentElement.style.opacity = '0';
      document.documentElement.style.transition = 'opacity 150ms';
    };
    
    router.events.on('routeChangeStart', handleRouteChange);
    
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router]);

  return (
    <div style={{ transition: 'opacity 150ms', opacity: 1 }}>
      <Component {...pageProps} />
    </div>
  );
}
```

---

## 8. 접근성 (Accessibility)

### 8.1 ARIA 라벨

```jsx
// 버튼
<button aria-label="Close menu" onClick={handleClose}>
  ✕
</button>

// 탭
<div role="tablist">
  <button role="tab" aria-selected={active} aria-controls="panel-1">
    Tab 1
  </button>
</div>

// 모달
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm Action</h2>
</div>
```

### 8.2 키보드 네비게이션

```jsx
// Tab 키로 포커스 이동
<button tabIndex={0} onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleClick();
  }
}}>
  Click me
</button>
```

### 8.3 색상 대비

```
텍스트 색상 조합 (WCAG AA 준수):
✅ #f8fafc on #0f172a (Contrast: 18.5:1)
✅ #cbd5e1 on #1e293b (Contrast: 9.2:1)
✅ #06b6d4 on #0f172a (Contrast: 9.1:1)
```

---

## 9. 다크모드 구현

### 9.1 테마 토글

```jsx
// lib/useTheme.js
export function useTheme() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return { theme, toggleTheme };
}
```

### 9.2 CSS 변수 (라이트 모드)

```css
[data-theme="light"] {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-card: #ffffff;
  --color-bg-input: #f1f5f9;
  
  --color-border: #e2e8f0;
  --color-border-hover: #cbd5e1;
  
  --color-text-primary: #0f172a;
  --color-text-secondary: #334155;
  --color-text-tertiary: #64748b;
  
  /* ... 나머지 색상 반전 ... */
}
```

---

## 10. 성능 최적화

### 10.1 이미지 최적화

```jsx
// Next.js Image 컴포넌트 사용
import Image from 'next/image';

<Image
  src="/images/user-avatar.jpg"
  alt="User profile picture"
  width={64}
  height={64}
  priority={false}
  quality={75}
/>
```

### 10.2 번들 크기 감소

```javascript
// 동적 임포트
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Spinner />,
});
```

### 10.3 Lighthouse 목표

```
Performance:   ≥ 80
Accessibility: ≥ 95
Best Practice: ≥ 90
SEO:          ≥ 90
```

---

## 체크리스트

### 설계 검수

- [ ] 색상팔레트 확정
- [ ] 타이포그래피 테스트 (모든 브라우저)
- [ ] 컴포넌트 라이브러리 완성
- [ ] 반응형 테스트 (mobile, tablet, desktop)
- [ ] 접근성 감사 (WCAG AA 준수)
- [ ] 성능 측정 (Lighthouse)

### 구현 검수

- [ ] Storybook 또는 컴포넌트 데모 페이지
- [ ] 다크모드 동작 확인
- [ ] 애니메이션 부드러운 동작
- [ ] 모든 상태 (hover, focus, active, disabled) 테스트
- [ ] iOS/Android 모바일 기기 테스트

---

**다음:** 웹개발자가 이 문서를 기반으로 컴포넌트 구현 시작
