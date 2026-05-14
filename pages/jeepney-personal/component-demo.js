import React, { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FormSection from '../../components/ui/FormSection';
import TabNav from '../../components/jeepney/TabNav';
import { colors, spacing, typography } from '../../lib/design-tokens';

export default function ComponentDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons');
  const [inputValue, setInputValue] = useState('');

  const containerStyle = {
    padding: spacing['2xl'],
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const sectionStyle = {
    marginBottom: spacing['3xl'],
  };

  const sectionTitleStyle = {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    borderBottom: `2px solid ${colors.accentCyan}`,
    paddingBottom: spacing.md,
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  };

  const componentBoxStyle = {
    padding: spacing.lg,
    backgroundColor: colors.bgSecondary,
    borderRadius: '8px',
    border: `1px solid ${colors.borderLight}`,
  };

  const tabs = [
    { id: 'buttons', label: 'Buttons' },
    { id: 'forms', label: 'Forms' },
    { id: 'cards', label: 'Cards & Layout' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'modals', label: 'Modals' },
  ];

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: typography.sizes['4xl'], marginBottom: spacing.xl, color: colors.accentCyan }}>
        JEEPNEY Component Library
      </h1>

      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        style={{ marginBottom: spacing['2xl'] }}
      />

      {/* Buttons Section */}
      {activeTab === 'buttons' && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Buttons</h2>

          <div>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>Variants</h3>
            <div style={gridStyle}>
              <div style={componentBoxStyle}>
                <Button variant="primary">Primary</Button>
              </div>
              <div style={componentBoxStyle}>
                <Button variant="secondary">Secondary</Button>
              </div>
              <div style={componentBoxStyle}>
                <Button variant="danger">Danger</Button>
              </div>
              <div style={componentBoxStyle}>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>Sizes</h3>
            <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
              <Button size="sm" variant="primary">Small</Button>
              <Button size="md" variant="primary">Medium</Button>
              <Button size="lg" variant="primary">Large</Button>
            </div>
          </div>

          <div style={{ marginTop: spacing.xl }}>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>States</h3>
            <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="primary" loading>Loading</Button>
            </div>
          </div>
        </div>
      )}

      {/* Forms Section */}
      {activeTab === 'forms' && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Form Components</h2>

          <div style={{ display: 'grid', gap: spacing.xl, maxWidth: '400px' }}>
            <Input
              label="Text Input"
              placeholder="Enter your name"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              helperText="Must be at least 8 characters"
            />
            <Input
              label="Error State"
              placeholder="Invalid input"
              error
              helperText="This field contains an error"
            />
            <FormSection
              title="Personal Information"
              description="Please provide your basic information"
              required
            >
              <Input
                label="Full Name"
                placeholder="John Doe"
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="john@example.com"
              />
            </FormSection>
          </div>
        </div>
      )}

      {/* Cards & Layout */}
      {activeTab === 'cards' && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Cards & Avatars</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
            <Card header="Card with Header">
              This card has a header section. You can use it for titles or key information.
            </Card>
            <Card header="Interactive Card" hoverable>
              Hover over this card to see the interactive state.
            </Card>
            <Card footer="Footer Content">
              This card has footer content below the main body area.
            </Card>
            <Card header="Complete Card" footer="Last updated: Today">
              A complete card with header, body, and footer sections.
            </Card>
          </div>

          <div style={{ marginTop: spacing['2xl'] }}>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>Avatars</h3>
            <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center', flexWrap: 'wrap' }}>
              <Avatar size="sm" initials="JD" />
              <Avatar size="md" initials="AB" />
              <Avatar size="lg" initials="XY" />
            </div>
          </div>
        </div>
      )}

      {/* Feedback Components */}
      {activeTab === 'feedback' && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Feedback Components</h2>

          <div>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>Spinners</h3>
            <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.xl }}>
              <Spinner size="24px" />
              <Spinner size="32px" />
              <Spinner size="48px" />
            </div>
          </div>

          <div>
            <h3 style={{ color: colors.textSecondary, marginBottom: spacing.md }}>Badges</h3>
            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge variant="default">Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge variant="default" size="lg">Large Badge</Badge>
              <Badge variant="success" size="sm">Small</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Modals Section */}
      {activeTab === 'modals' && (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Modals</h2>
          <Button onClick={() => setModalOpen(true)} variant="primary">
            Open Modal
          </Button>
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Modal Example"
            size="md"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Confirm
                </Button>
              </>
            }
          >
            <p>This is a modal dialog. You can close it by clicking the X button, pressing ESC, or clicking the backdrop.</p>
            <p style={{ marginTop: spacing.md, color: colors.textTertiary, fontSize: typography.sizes.sm }}>
              Features: ESC to close, backdrop click to close, smooth animations
            </p>
          </Modal>
        </div>
      )}

      {/* Responsive Info */}
      <div style={{ marginTop: spacing['3xl'], padding: spacing.lg, backgroundColor: colors.bgSecondary, borderRadius: '8px' }}>
        <h3 style={{ color: colors.accentCyan, marginBottom: spacing.md }}>Responsive Breakpoints</h3>
        <p style={{ color: colors.textSecondary, fontSize: typography.sizes.sm }}>
          Test these breakpoints: Mobile (640px), Tablet (1024px), Desktop (1280px)
        </p>
      </div>
    </div>
  );
}
