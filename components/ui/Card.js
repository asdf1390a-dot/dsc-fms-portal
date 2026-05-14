import React from 'react';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/design-tokens';

const Card = React.forwardRef(({
  children,
  header,
  footer,
  hoverable = false,
  className,
  ...props
}, ref) => {
  const baseStyle = {
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    overflow: 'hidden',
    transition: 'all 200ms ease-in-out',
    cursor: hoverable ? 'pointer' : 'default',
  };

  const hoverStyle = hoverable ? {
    ':hover': {
      boxShadow: shadows.lg,
      transform: 'translateY(-2px)',
    },
  } : {};

  return (
    <div
      ref={ref}
      style={{
        ...baseStyle,
        ...hoverStyle,
      }}
      className={className}
      {...props}
    >
      {header && (
        <div
          style={{
            padding: spacing.lg,
            borderBottom: `1px solid ${colors.borderLight}`,
            fontWeight: typography.weights.semibold,
            fontSize: typography.sizes.lg,
            color: colors.textPrimary,
          }}
        >
          {header}
        </div>
      )}
      <div
        style={{
          padding: spacing.lg,
          color: colors.textSecondary,
          fontSize: typography.sizes.base,
          lineHeight: typography.lineHeights.normal,
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            padding: spacing.lg,
            borderTop: `1px solid ${colors.borderLight}`,
            backgroundColor: colors.bgPrimary,
            fontSize: typography.sizes.sm,
            color: colors.textTertiary,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
