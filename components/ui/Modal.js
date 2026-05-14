import React from 'react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../lib/design-tokens';

const Modal = React.forwardRef(({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  className,
  ...props
}, ref) => {
  React.useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: '320px' },
    md: { maxWidth: '480px' },
    lg: { maxWidth: '720px' },
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
    animation: 'fadeIn 200ms ease-out',
  };

  const modalStyle = {
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.xl,
    border: `1px solid ${colors.borderLight}`,
    maxHeight: '90vh',
    overflow: 'auto',
    ...sizeStyles[size],
    animation: 'slideUp 300ms ease-out',
  };

  const headerStyle = {
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.borderLight}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const titleStyle = {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: typography.sizes.lg,
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
    transition: transitions.base,
    ':hover': {
      color: colors.textPrimary,
    },
  };

  const contentStyle = {
    padding: spacing.lg,
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    lineHeight: typography.lineHeights.normal,
  };

  const footerStyle = {
    padding: spacing.lg,
    borderTop: `1px solid ${colors.borderLight}`,
    backgroundColor: colors.bgPrimary,
    display: 'flex',
    gap: spacing.md,
    justifyContent: 'flex-end',
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        style={overlayStyle}
        onClick={() => closeOnBackdrop && onClose?.()}
      >
        <div
          ref={ref}
          style={modalStyle}
          onClick={(e) => e.stopPropagation()}
          className={className}
          {...props}
        >
          {title && (
            <div style={headerStyle}>
              <h2 style={titleStyle}>{title}</h2>
              <button
                style={closeButtonStyle}
                onClick={onClose}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
          )}
          <div style={contentStyle}>
            {children}
          </div>
          {footer && (
            <div style={footerStyle}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
});

Modal.displayName = 'Modal';

export default Modal;
