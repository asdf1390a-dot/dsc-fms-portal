import React from 'react';
import { colors, spacing, typography, borderRadius, transitions } from '../../lib/design-tokens';

const TabNav = React.forwardRef(({
  tabs,
  activeTab,
  onTabChange,
  className,
  ...props
}, ref) => {
  const [underlineStyle, setUnderlineStyle] = React.useState({});
  const navRef = React.useRef(null);
  const tabRefs = React.useRef({});

  React.useEffect(() => {
    if (tabRefs.current[activeTab]) {
      const tab = tabRefs.current[activeTab];
      setUnderlineStyle({
        left: `${tab.offsetLeft}px`,
        width: `${tab.offsetWidth}px`,
      });
    }
  }, [activeTab]);

  const baseStyle = {
    display: 'flex',
    gap: spacing.lg,
    borderBottom: `2px solid ${colors.borderLight}`,
    overflow: 'auto',
    scrollBehavior: 'smooth',
    position: 'relative',
  };

  const tabStyle = (isActive) => ({
    padding: `${spacing.md} 0`,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: isActive ? colors.accentCyan : colors.textSecondary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: transitions.base,
    position: 'relative',
    outline: 'none',
    ':hover': {
      color: colors.accentCyan,
    },
  });

  const underlineIndicatorStyle = {
    position: 'absolute',
    bottom: '-2px',
    height: '2px',
    backgroundColor: colors.accentCyan,
    transition: `all ${transitions.base}`,
    ...underlineStyle,
  };

  return (
    <div
      ref={navRef}
      style={baseStyle}
      className={className}
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) tabRefs.current[tab.id] = el;
          }}
          style={tabStyle(activeTab === tab.id)}
          onClick={() => onTabChange?.(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
      <div style={underlineIndicatorStyle} />
    </div>
  );
});

TabNav.displayName = 'TabNav';

export default TabNav;
