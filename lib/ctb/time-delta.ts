/**
 * Time delta calculation for CTB real-time schedule adjustments
 * Compares actual completion time vs estimated time to determine schedule acceleration
 */

/**
 * Calculate time delta between two commits in minutes
 * Returns positive value if completed earlier than estimated
 */
export function calculateTimeDelta(
  currentCommitTime: Date,
  previousCommitTime: Date,
  estimatedMinutes: number
): {
  actualMinutes: number;
  timeDelta: number;
  isAccelerated: boolean;
} {
  const actualMinutes = Math.round((currentCommitTime.getTime() - previousCommitTime.getTime()) / 60000);
  const timeDelta = estimatedMinutes - actualMinutes; // Positive = ahead of schedule

  return {
    actualMinutes,
    timeDelta,
    isAccelerated: timeDelta > 0,
  };
}

/**
 * Adjust ETA for next task based on time delta
 * Formula: newETA = originalETA - timeDelta
 */
export function adjustNextTaskETA(
  originalETA: Date,
  timeDeltaMinutes: number
): {
  newETA: Date;
  minutesPulledForward: number;
} {
  if (timeDeltaMinutes <= 0) {
    return {
      newETA: originalETA,
      minutesPulledForward: 0,
    };
  }

  const newETA = new Date(originalETA.getTime() - timeDeltaMinutes * 60000);

  return {
    newETA,
    minutesPulledForward: timeDeltaMinutes,
  };
}

/**
 * Format time delta for display
 * Examples: "+15분", "-10분", "정시"
 */
export function formatTimeDelta(timeDeltaMinutes: number): string {
  if (timeDeltaMinutes > 0) {
    return `+${timeDeltaMinutes}분`;
  } else if (timeDeltaMinutes < 0) {
    return `${timeDeltaMinutes}분`;
  } else {
    return '정시';
  }
}

/**
 * Format ETA change for display
 * Example: "15:00 → 14:45"
 */
export function formatETAChange(originalETA: Date, newETA: Date): string {
  const originalStr = originalETA.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const newStr = newETA.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${originalStr} → ${newStr}`;
}

/**
 * Parse ETA string in "HH:MM" format to Date
 * Assumes today's date in KST
 */
export function parseETAString(etaStr: string): Date | null {
  const match = etaStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const [, hourStr, minuteStr] = match;
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const now = new Date();
  const eta = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );

  // Handle timezone offset for KST (UTC+9)
  const offset = eta.getTimezoneOffset() + 9 * 60; // KST offset
  eta.setMinutes(eta.getMinutes() + offset);

  return eta;
}

/**
 * Format Date as "HH:MM" string for CTB
 */
export function formatETAString(date: Date): string {
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
