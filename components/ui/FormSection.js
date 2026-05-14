import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

const FormSection = React.forwardRef(({
  title,
  description,
  children,
  required,
  error,
  className,
  ...props
}, ref) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const headerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  };

  const titleStyle = {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    margin: 0,
  };

  const requiredStyle = {
    color: colors.error,
  };

  const descriptionStyle = {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
    margin: 0,
  };

  const contentStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bgPrimary,
    borderRadius: borderRadius.md,
    border: `1px solid ${error ? colors.error : colors.borderLight}`,
  };

  const errorStyle = {
    fontSize: typography.sizes.sm,
    color: colors.error,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  };

  return (
    <div
      ref={ref}
      style={containerStyle}
      className={className}
      {...props}
    >
      {(title || description) && (
        <div style={headerStyle}>
          {title && (
            <h3 style={titleStyle}>
              {title}
              {required && <span style={requiredStyle}>*</span>}
            </h3>
          )}
          {description && (
            <p style={descriptionStyle}>{description}</p>
          )}
        </div>
      )}
      <div style={contentStyle}>
        {children}
      </div>
      {error && (
        <div style={errorStyle}>
          <span>⚠️</span>
          {error}
        </div>
      )}
    </div>
  );
});

FormSection.displayName = 'FormSection';

export default FormSection;
