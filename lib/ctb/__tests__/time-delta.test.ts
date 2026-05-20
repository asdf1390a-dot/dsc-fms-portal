/**
 * Unit tests for time-delta calculation utilities
 * Validates time delta calculation and ETA adjustment logic
 */

import {
  calculateTimeDelta,
  adjustNextTaskETA,
  formatTimeDelta,
  formatETAChange,
  parseETAString,
  formatETAString,
} from '../time-delta';

describe('calculateTimeDelta', () => {
  test('should calculate positive time delta when ahead of schedule', () => {
    const startTime = new Date('2026-05-18T14:00:00Z');
    const endTime = new Date('2026-05-18T14:30:00Z');
    const estimatedMinutes = 60;

    const result = calculateTimeDelta(endTime, startTime, estimatedMinutes);

    expect(result.actualMinutes).toBe(30);
    expect(result.timeDelta).toBe(30); // 60 - 30 = 30 minutes ahead
    expect(result.isAccelerated).toBe(true);
  });

  test('should calculate negative time delta when behind schedule', () => {
    const startTime = new Date('2026-05-18T14:00:00Z');
    const endTime = new Date('2026-05-18T15:30:00Z');
    const estimatedMinutes = 60;

    const result = calculateTimeDelta(endTime, startTime, estimatedMinutes);

    expect(result.actualMinutes).toBe(90);
    expect(result.timeDelta).toBe(-30); // 60 - 90 = -30 minutes behind
    expect(result.isAccelerated).toBe(false);
  });

  test('should calculate zero time delta when on schedule', () => {
    const startTime = new Date('2026-05-18T14:00:00Z');
    const endTime = new Date('2026-05-18T15:00:00Z');
    const estimatedMinutes = 60;

    const result = calculateTimeDelta(endTime, startTime, estimatedMinutes);

    expect(result.actualMinutes).toBe(60);
    expect(result.timeDelta).toBe(0);
    expect(result.isAccelerated).toBe(false);
  });

  test('should round actual minutes to nearest integer', () => {
    const startTime = new Date('2026-05-18T14:00:00Z');
    const endTime = new Date('2026-05-18T14:30:30Z');
    const estimatedMinutes = 45;

    const result = calculateTimeDelta(endTime, startTime, estimatedMinutes);

    expect(result.actualMinutes).toBe(31); // 30.5 minutes rounded
  });
});

describe('adjustNextTaskETA', () => {
  test('should adjust ETA forward when time delta is positive', () => {
    const originalETA = new Date('2026-05-18T16:00:00Z');
    const timeDelta = 30;

    const result = adjustNextTaskETA(originalETA, timeDelta);

    expect(result.minutesPulledForward).toBe(30);
    const timeDiff = (originalETA.getTime() - result.newETA.getTime()) / 60000;
    expect(timeDiff).toBe(30);
  });

  test('should not adjust ETA when time delta is zero', () => {
    const originalETA = new Date('2026-05-18T16:00:00Z');
    const timeDelta = 0;

    const result = adjustNextTaskETA(originalETA, timeDelta);

    expect(result.minutesPulledForward).toBe(0);
    expect(result.newETA.getTime()).toBe(originalETA.getTime());
  });

  test('should not adjust ETA when time delta is negative', () => {
    const originalETA = new Date('2026-05-18T16:00:00Z');
    const timeDelta = -15;

    const result = adjustNextTaskETA(originalETA, timeDelta);

    expect(result.minutesPulledForward).toBe(0);
    expect(result.newETA.getTime()).toBe(originalETA.getTime());
  });
});

describe('formatTimeDelta', () => {
  test('should format positive time delta', () => {
    expect(formatTimeDelta(15)).toBe('+15분');
    expect(formatTimeDelta(1)).toBe('+1분');
    expect(formatTimeDelta(60)).toBe('+60분');
  });

  test('should format negative time delta', () => {
    expect(formatTimeDelta(-15)).toBe('-15분');
    expect(formatTimeDelta(-1)).toBe('-1분');
  });

  test('should format zero time delta', () => {
    expect(formatTimeDelta(0)).toBe('정시');
  });
});

describe('formatETAChange', () => {
  test('should format ETA change correctly', () => {
    const original = new Date('2026-05-18T16:00:00+09:00');
    const updated = new Date('2026-05-18T15:30:00+09:00');

    const formatted = formatETAChange(original, updated);

    expect(formatted).toMatch(/\d{2}:\d{2} → \d{2}:\d{2}/);
    // The exact time depends on timezone handling, so just verify format
  });
});

describe('parseETAString', () => {
  test('should parse valid HH:MM format', () => {
    const parsed = parseETAString('14:30');

    expect(parsed).not.toBeNull();
    expect(parsed?.getHours()).toBe(14);
    expect(parsed?.getMinutes()).toBe(30);
  });

  test('should parse single-digit hours', () => {
    const parsed = parseETAString('9:15');

    expect(parsed).not.toBeNull();
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(15);
  });

  test('should return null for invalid format', () => {
    expect(parseETAString('invalid')).toBeNull();
    expect(parseETAString('25:00')).toBeNull();
    expect(parseETAString('14:60')).toBeNull();
    expect(parseETAString('14')).toBeNull();
  });

  test('should handle edge case times', () => {
    expect(parseETAString('00:00')).not.toBeNull();
    expect(parseETAString('23:59')).not.toBeNull();
  });
});

describe('formatETAString', () => {
  test('should format Date as HH:MM string', () => {
    const date = new Date('2026-05-18T14:30:00+09:00');
    const formatted = formatETAString(date);

    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  test('should use 24-hour format', () => {
    const afternoon = new Date('2026-05-18T14:30:00+09:00');
    const formatted = formatETAString(afternoon);

    // Should not contain 'PM' (24-hour format)
    expect(formatted).not.toContain('PM');
    expect(formatted).not.toContain('AM');
  });
});
