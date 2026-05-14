import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { colors, spacing, typography } from '../../lib/design-tokens';

/**
 * DeleteConfirmDialog — modal confirming destructive backup deletion.
 *
 * Props:
 *   isOpen: bool
 *   backup_name: string
 *   onConfirm: () => void
 *   onCancel: () => void
 *   busy?: bool
 */
export default function DeleteConfirmDialog({
  isOpen,
  backup_name,
  onConfirm,
  onCancel,
  busy = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onCancel}
      title="백업 삭제"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm} disabled={busy}>
            {busy ? '삭제 중…' : '삭제'}
          </Button>
        </>
      }
    >
      <p style={S.text}>
        정말 삭제하시겠습니까?
      </p>
      <p style={S.target}>
        “{backup_name || '(이름 없음)'}”
      </p>
      <p style={S.warn}>
        이 작업은 되돌릴 수 없습니다. 백업 파일과 메타데이터가 영구 삭제됩니다.
      </p>
    </Modal>
  );
}

const S = {
  text: {
    margin: 0,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  target: {
    margin: `${spacing.md} 0`,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.accentCyan,
    wordBreak: 'break-all',
  },
  warn: {
    margin: 0,
    fontSize: typography.sizes.sm,
    color: colors.warning,
  },
};
