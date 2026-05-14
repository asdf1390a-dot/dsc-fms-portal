// Design Tokens for JEEPNEY Personal Portal
// Complete design system with colors, spacing, typography, and effects

export const colors = {
  // Primary backgrounds
  bgPrimary: '#0f172a',      // Dark blue
  bgSecondary: '#1e293b',    // Lighter dark blue
  bgTertiary: '#334155',     // Even lighter

  // Text colors
  textPrimary: '#f8fafc',    // Near white
  textSecondary: '#cbd5e1',  // Gray
  textTertiary: '#94a3b8',   // Darker gray

  // Accent colors
  accentCyan: '#06b6d4',     // Cyan
  accentCyan200: '#22d3ee',  // Light cyan
  accentCyan600: '#0891b2',  // Dark cyan

  // Status colors
  success: '#10b981',        // Green
  warning: '#f59e0b',        // Amber
  error: '#ef4444',          // Red
  info: '#3b82f6',           // Blue

  // Border & dividers
  borderLight: '#475569',    // Border for dark theme
  borderDark: '#1e293b',     // Darker border

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.7)',  // Semi-transparent dark
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
};

export const typography = {
  fonts: {
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    korean: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'Menlo', 'Monaco', 'Courier New', monospace",
  },
  sizes: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '32px',
  },
  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
  },
};

export const borderRadius = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
};

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  cyan: '0 0 20px rgba(6, 182, 212, 0.3)',
};

export const transitions = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};

// CSS variables for global styling
export const getCSSVariables = () => `
  :root {
    /* Colors */
    --color-bg-primary: ${colors.bgPrimary};
    --color-bg-secondary: ${colors.bgSecondary};
    --color-bg-tertiary: ${colors.bgTertiary};
    --color-text-primary: ${colors.textPrimary};
    --color-text-secondary: ${colors.textSecondary};
    --color-text-tertiary: ${colors.textTertiary};
    --color-accent-cyan: ${colors.accentCyan};
    --color-accent-cyan-200: ${colors.accentCyan200};
    --color-accent-cyan-600: ${colors.accentCyan600};
    --color-success: ${colors.success};
    --color-warning: ${colors.warning};
    --color-error: ${colors.error};
    --color-info: ${colors.info};
    --color-border-light: ${colors.borderLight};
    --color-border-dark: ${colors.borderDark};

    /* Spacing */
    --spacing-xs: ${spacing.xs};
    --spacing-sm: ${spacing.sm};
    --spacing-md: ${spacing.md};
    --spacing-lg: ${spacing.lg};
    --spacing-xl: ${spacing.xl};
    --spacing-2xl: ${spacing['2xl']};
    --spacing-3xl: ${spacing['3xl']};
    --spacing-4xl: ${spacing['4xl']};

    /* Typography */
    --font-body: ${typography.fonts.body};
    --font-korean: ${typography.fonts.korean};
    --font-mono: ${typography.fonts.mono};

    /* Border Radius */
    --radius-xs: ${borderRadius.xs};
    --radius-sm: ${borderRadius.sm};
    --radius-md: ${borderRadius.md};
    --radius-lg: ${borderRadius.lg};
    --radius-xl: ${borderRadius.xl};
    --radius-2xl: ${borderRadius['2xl']};

    /* Shadows */
    --shadow-sm: ${shadows.sm};
    --shadow-base: ${shadows.base};
    --shadow-md: ${shadows.md};
    --shadow-lg: ${shadows.lg};
    --shadow-xl: ${shadows.xl};

    /* Transitions */
    --transition-fast: ${transitions.fast};
    --transition-base: ${transitions.base};
    --transition-slow: ${transitions.slow};
  }

  * {
    transition: background-color var(--transition-base), color var(--transition-base), border-color var(--transition-base);
  }
`;

export default {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  getCSSVariables,
};
