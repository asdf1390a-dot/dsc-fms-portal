/**
 * Unit tests for ETA calculator utilities
 * Validates task lookup, ETA parsing, and schedule pulling logic
 */

import {
  findNextTask,
  extractScheduledETA,
  updateTaskETA,
  calcETAChange,
  parseCTBEntry,
  isTaskComplete,
  getIncompleteTasks,
} from '../eta-calculator';

const mockCTBContent = `
| 날짜 | 작업명 | 예정(분) | 실제(분) | 시간델타 | 다음작업 원래ETA | 새로운ETA | 당겨온분 |
|------|--------|:---:|:---:|:---:|---------|---------|:---:|
| 2026-05-18 | Asset API | 60 | 45 | +15 | 15:00 | 14:45 | ✅ |
| 2026-05-18 | Database Setup | 90 | — | — | 16:30 | — | — |
| 2026-05-18 | Testing | 60 | — | — | 17:30 | — | — |
| 2026-05-18 | Deployment | 45 | — | — | 18:15 | — | — |
`;

describe('findNextTask', () => {
  test('should find next incomplete task after current', () => {
    const result = findNextTask(mockCTBContent, 'Asset API');

    expect(result).not.toBeNull();
    expect(result?.taskName).toContain('Database Setup');
    expect(result?.eta).toBe('16:30');
  });

  test('should return null if no next task exists', () => {
    const result = findNextTask(mockCTBContent, 'Deployment');

    expect(result).toBeNull();
  });

  test('should return null if current task not found', () => {
    const result = findNextTask(mockCTBContent, 'Nonexistent Task');

    expect(result).toBeNull();
  });

  test('should skip already-adjusted tasks (with new ETA)', () => {
    // Asset API is completed with new ETA, so next should be Database Setup
    const result = findNextTask(mockCTBContent, 'Asset API');

    expect(result?.taskName).toContain('Database Setup');
  });
});

describe('extractScheduledETA', () => {
  const testEntry = '| 2026-05-18 | Asset API | 60 | 45 | +15 | 15:00 | 14:45 | ✅ |';

  test('should parse valid ETA from entry', () => {
    const result = extractScheduledETA(testEntry);

    expect(result).not.toBeNull();
    expect(result?.getHours()).toBe(15);
    expect(result?.getMinutes()).toBe(0);
  });

  test('should return null for entry without ETA', () => {
    const entryWithoutETA = '| 2026-05-18 | Task | 60 | — | — | — | — | — |';
    const result = extractScheduledETA(entryWithoutETA);

    expect(result).toBeNull();
  });

  test('should handle edge case times', () => {
    const earlyEntry = '| 2026-05-18 | Early Task | 60 | 50 | +10 | 09:00 | — | — |';
    const result = extractScheduledETA(earlyEntry);

    expect(result?.getHours()).toBe(9);
    expect(result?.getMinutes()).toBe(0);
  });
});

describe('updateTaskETA', () => {
  test('should update new ETA in CTB entry', () => {
    const futureETA = new Date();
    futureETA.setHours(14, 45);

    const updated = updateTaskETA(mockCTBContent, 'Database Setup', futureETA);

    expect(updated).toContain('Database Setup');
    // Should have updated the new ETA column
    expect(updated).toMatch(/Database Setup.*\| 14:45 \|/);
  });

  test('should maintain markdown table format', () => {
    const futureETA = new Date();
    futureETA.setHours(16, 15);

    const updated = updateTaskETA(mockCTBContent, 'Testing', futureETA);

    // Should still be valid markdown
    expect(updated).toContain('|');
    expect(updated).toContain('Testing');
  });

  test('should only update first matching task', () => {
    const contentWithDuplicates = `
| 날짜 | 작업명 | 예정(분) | 실제(분) | 시간델타 | 다음작업 원래ETA | 새로운ETA | 당겨온분 |
|------|--------|:---:|:---:|:---:|---------|---------|:---:|
| 2026-05-18 | Setup | 60 | 45 | +15 | 14:00 | — | — |
| 2026-05-18 | Setup | 90 | — | — | 15:30 | — | — |
`;
    const futureETA = new Date();
    futureETA.setHours(13, 45);

    const updated = updateTaskETA(contentWithDuplicates, 'Setup', futureETA);

    // Count how many times 13:45 appears
    const matches = (updated.match(/13:45/g) || []).length;
    expect(matches).toBe(1); // Should only update first occurrence
  });
});

describe('calcETAChange', () => {
  test('should calculate positive minutes pulled forward', () => {
    const oldETA = new Date('2026-05-18T16:00:00Z');
    const newETA = new Date('2026-05-18T15:30:00Z');

    const result = calcETAChange(oldETA, newETA);

    expect(result.minutesPulled).toBe(30);
    expect(result.changed).toBe(true);
  });

  test('should return zero when ETAs are same', () => {
    const sameETA = new Date('2026-05-18T16:00:00Z');

    const result = calcETAChange(sameETA, sameETA);

    expect(result.minutesPulled).toBe(0);
    expect(result.changed).toBe(false);
  });

  test('should handle negative delta (no pulling)', () => {
    const oldETA = new Date('2026-05-18T15:30:00Z');
    const newETA = new Date('2026-05-18T16:00:00Z');

    const result = calcETAChange(oldETA, newETA);

    expect(result.minutesPulled).toBe(0); // Should not be negative
    expect(result.changed).toBe(false);
  });

  test('should handle large time differences', () => {
    const oldETA = new Date('2026-05-18T16:00:00Z');
    const newETA = new Date('2026-05-18T14:00:00Z');

    const result = calcETAChange(oldETA, newETA);

    expect(result.minutesPulled).toBe(120);
    expect(result.changed).toBe(true);
  });
});

describe('parseCTBEntry', () => {
  test('should parse valid CTB table row', () => {
    const entry = '| 2026-05-18 | Asset API | 60 | 45 | +15 | 15:00 | 14:45 | ✅ |';
    const result = parseCTBEntry(entry);

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-05-18');
    expect(result?.taskName).toBe('Asset API');
    expect(result?.estimatedMinutes).toBe(60);
    expect(result?.actualMinutes).toBe(45);
  });

  test('should return null for invalid row (wrong column count)', () => {
    const invalidEntry = '| 2026-05-18 | Task | 60 |';
    const result = parseCTBEntry(invalidEntry);

    expect(result).toBeNull();
  });

  test('should return null if numeric columns are invalid', () => {
    const invalidEntry = '| 2026-05-18 | Task | invalid | 45 | +15 | 15:00 | — | — |';
    const result = parseCTBEntry(invalidEntry);

    expect(result).toBeNull();
  });

  test('should handle incomplete task entries', () => {
    const incompleteEntry = '| 2026-05-18 | Database Setup | 90 | — | — | 16:30 | — | — |';
    const result = parseCTBEntry(incompleteEntry);

    // When actual is —, parseInt returns NaN, should return null
    expect(result).toBeNull(); // Or handle this case differently based on requirements
  });
});

describe('isTaskComplete', () => {
  test('should recognize completed task with status marker', () => {
    const entry = {
      date: '2026-05-18',
      taskName: 'Asset API',
      estimatedMinutes: 60,
      actualMinutes: 45,
      timeDelta: '+15',
      originalETA: '15:00',
      newETA: '14:45',
      status: '✅',
    };

    expect(isTaskComplete(entry)).toBe(true);
  });

  test('should recognize incomplete task without new ETA', () => {
    const entry = {
      date: '2026-05-18',
      taskName: 'Database Setup',
      estimatedMinutes: 90,
      actualMinutes: 0,
      timeDelta: '—',
      originalETA: '16:30',
      newETA: '—',
      status: '—',
    };

    expect(isTaskComplete(entry)).toBe(false);
  });

  test('should recognize completed task by new ETA presence', () => {
    const entry = {
      date: '2026-05-18',
      taskName: 'Testing',
      estimatedMinutes: 60,
      actualMinutes: 50,
      timeDelta: '+10',
      originalETA: '17:30',
      newETA: '17:20',
      status: '—',
    };

    expect(isTaskComplete(entry)).toBe(true);
  });
});

describe('getIncompleteTasks', () => {
  test('should return all incomplete tasks', () => {
    const result = getIncompleteTasks(mockCTBContent);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((task) => task.taskName.includes('Database Setup'))).toBe(true);
  });

  test('should exclude completed tasks', () => {
    const result = getIncompleteTasks(mockCTBContent);

    // Asset API is completed (has status ✅), should not be in incomplete list
    expect(result.every((task) => !task.taskName.includes('Asset API'))).toBe(true);
  });

  test('should return empty array for content without table', () => {
    const result = getIncompleteTasks('No table here');

    expect(result).toEqual([]);
  });
});
