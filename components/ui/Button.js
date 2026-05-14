import React from 'react';
import { colors, spacing, typography, borderRadius, transitions } from '../../lib/design-tokens';

const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  ...props
}, ref) => {
  const sizeStyles = {
    sm: {
      padding: `${spacing.xs} ${spacing.md}`,
      fontSize: typography.sizes.sm,
      height: '32px',
    },
    md: {
      padding: `${spacing.sm} ${spacing.lg}`,
      fontSize: typography.sizes.base,
      height: '40px',
    },
    lg: {
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: typography.sizes.lg,
      height: '48px',
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: colors.accentCyan,
      color: colors.bgPrimary,
      border: `2px solid ${colors.accentCyan}`,
      ':hover': {
        backgroundColor: colors.accentCyan600,
        borderColor: colors.accentCyan600,
      },
      ':active': {
        backgroundColor: colors.accentCyan600,
      },
    },
    secondary: {
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
      border: `2px solid ${colors.borderLight}`,
      ':hover': {
        backgroundColor: colors.bgTertiary,
      },
      ':active': {
        backgroundColor: colors.bgTertiary,
      },
    },
    danger: {
      backgroundColor: colors.error,
      color: colors.textPrimary,
      border: `2px solid ${colors.error}`,
      ':hover': {
        backgroundColor: '#dc2626',
      },
      ':active': {
        backgroundColor: '#b91c1c',
      },
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.accentCyan,
      border: `2px solid ${colors.accentCyan}`,
      ':hover': {
        backgroundColor: `${colors.accentCyan}20`,
      },
      ':active': {
        backgroundColor: `${colors.accentCyan}30`,
      },
    },
  };

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    fontFamily: typography.fonts.body,
    fontWeight: typography.weights.medium,
    borderRadius: borderRadius.md,
    border: '2px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: transitions.base,
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap',
    outline: 'none',
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <button
      ref={ref}
      style={baseStyle}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      {...props}
    >
      {loading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            animation: 'spin 1s linear infinite',
          }}
        >
          <circle cx="12" cy="12" r="10" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
