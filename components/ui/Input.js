import React from 'react';
import { colors, spacing, typography, borderRadius, transitions } from '../../lib/design-tokens';

const Input = React.forwardRef(({
  label,
  placeholder,
  error,
  helperText,
  required,
  disabled,
  value,
  onChange,
  type = 'text',
  className,
  ...props
}, ref) => {
  const [focused, setFocused] = React.useState(false);

  const baseInputStyle = {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizes.base,
    fontFamily: typography.fonts.body,
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    border: `2px solid ${error ? colors.error : colors.borderLight}`,
    borderRadius: borderRadius.md,
    transition: transitions.base,
    outline: 'none',
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    width: '100%',
  };

  const labelStyle = {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const requiredStyle = {
    color: colors.error,
  };

  const helperTextStyle = {
    fontSize: typography.sizes.xs,
    color: error ? colors.error : colors.textTertiary,
  };

  return (
    <div style={containerStyle} className={className}>
      {label && (
        <label style={labelStyle}>
          {label}
          {required && <span style={requiredStyle}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...baseInputStyle,
          borderColor: focused ? colors.accentCyan : (error ? colors.error : colors.borderLight),
          boxShadow: focused ? `0 0 0 3px ${colors.accentCyan}20` : 'none',
        }}
        {...props}
      />
      {helperText && (
        <span style={helperTextStyle}>{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
