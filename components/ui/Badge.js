import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

const Badge = React.forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}, ref) => {
  const variantStyles = {
    default: {
      backgroundColor: colors.accentCyan,
      color: colors.bgPrimary,
    },
    success: {
      backgroundColor: colors.success,
      color: colors.textPrimary,
    },
    warning: {
      backgroundColor: colors.warning,
      color: colors.bgPrimary,
    },
    error: {
      backgroundColor: colors.error,
      color: colors.textPrimary,
    },
    info: {
      backgroundColor: colors.info,
      color: colors.textPrimary,
    },
    secondary: {
      backgroundColor: colors.bgTertiary,
      color: colors.textPrimary,
    },
  };

  const sizeStyles = {
    sm: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: typography.sizes.xs,
      height: '20px',
      minWidth: '20px',
    },
    md: {
      padding: `${spacing.xs} ${spacing.md}`,
      fontSize: typography.sizes.sm,
      height: '24px',
      minWidth: '24px',
    },
    lg: {
      padding: `${spacing.sm} ${spacing.lg}`,
      fontSize: typography.sizes.base,
      height: '32px',
      minWidth: '32px',
    },
  };

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    fontWeight: typography.weights.semibold,
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return (
    <span
      ref={ref}
      style={baseStyle}
      className={className}
      {...props}
    >
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;
