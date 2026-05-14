import React from 'react';
import { colors } from '../../lib/design-tokens';

const Spinner = React.forwardRef(({
  size = '24px',
  color = colors.accentCyan,
  className,
  ...props
}, ref) => {
  const spinnerStyle = {
    display: 'inline-block',
    width: size,
    height: size,
    position: 'relative',
  };

  const svgStyle = {
    width: '100%',
    height: '100%',
    animation: 'spin 1s linear infinite',
  };

  const circleStyle = {
    fill: 'none',
    stroke: color,
    strokeWidth: '2',
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div
        ref={ref}
        style={spinnerStyle}
        className={className}
        {...props}
      >
        <svg
          viewBox="0 0 24 24"
          style={svgStyle}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            style={{
              ...circleStyle,
              opacity: 0.3,
            }}
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            style={{
              ...circleStyle,
              strokeDasharray: '62.83',
              strokeDashoffset: '47.12',
              strokeLinecap: 'round',
            }}
          />
        </svg>
      </div>
    </>
  );
});

Spinner.displayName = 'Spinner';

export default Spinner;
