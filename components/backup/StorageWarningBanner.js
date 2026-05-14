import React from 'react';
import Link from 'next/link';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

/**
 * StorageWarningBanner — visible when usage_percent >= threshold (default 80).
 *
 * Props:
 *   usage_percent: number
 *   message?: string
 *   threshold?: number (default 80)
 *   manageHref?: string (default '/jeepney-personal/backup-app/storage')
 */
export default function StorageWarningBanner({
  usage_percent,
  message,
  threshold = 80,
  manageHref = '/jeepney-personal/backup-app/storage',
}) {
  const pct = Number(usage_percent);
  if (!Number.isFinite(pct) || pct < threshold) return null;

  const exceeded = pct >= 100;
  const tone = exceeded ? colors.error : colors.warning;

  return (
    <div
      role="alert"
      style={{
        ...S.banner,
        background: `${tone}1a`,
        borderColor: tone,
      }}
    >
      <div style={S.left}>
        <span style={{ ...S.icon, color: tone }} aria-hidden="true">⚠</span>
        <div>
          <p style={{ ...S.title, color: tone }}>
            {exceeded ? '저장소 할당량 초과' : '저장소 임계치 도달'}
          </p>
          <p style={S.msg}>
            {message || `현재 ${pct}% 사용 중입니다. 오래된 백업을 정리하세요.`}
          </p>
        </div>
      </div>
      <Link href={manageHref} style={{ ...S.link, color: tone, borderColor: tone }}>
        저장소 관리로 이동 →
      </Link>
    </div>
  );
}

const S = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.lg,
    border: '1px solid',
    borderRadius: borderRadius.lg,
    flexWrap: 'wrap',
  },
  left: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
    minWidth: '200px',
  },
  icon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  msg: {
    margin: `${spacing.xs} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  link: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    padding: `${spacing.sm} ${spacing.md}`,
    border: '1px solid',
    borderRadius: borderRadius.md,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
