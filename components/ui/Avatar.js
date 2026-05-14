import React from 'react';
import { colors, borderRadius, shadows, typography } from '../../lib/design-tokens';

const Avatar = React.forwardRef(({
  src,
  alt,
  size = 'md',
  initials,
  className,
  ...props
}, ref) => {
  const sizeStyles = {
    sm: {
      width: '32px',
      height: '32px',
      fontSize: typography.sizes.sm,
    },
    md: {
      width: '48px',
      height: '48px',
      fontSize: typography.sizes.base,
    },
    lg: {
      width: '64px',
      height: '64px',
      fontSize: typography.sizes.lg,
    },
  };

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    backgroundColor: colors.accentCyan,
    color: colors.bgPrimary,
    fontWeight: typography.weights.semibold,
    border: `2px solid ${colors.borderLight}`,
    flexShrink: 0,
    ...sizeStyles[size],
  };

  if (src) {
    return (
      <img
        ref={ref}
        src={src}
        alt={alt || 'Avatar'}
        style={baseStyle}
        className={className}
        {...props}
      />
    );
  }

  return (
    <div
      ref={ref}
      style={baseStyle}
      className={className}
      {...props}
    >
      {initials || '?'}
    </div>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;
