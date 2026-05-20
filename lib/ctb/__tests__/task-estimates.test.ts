/**
 * Unit tests for task-estimates utility
 * Validates task estimate lookup, dynamic updates, and learning functions
 */

import { getTaskEstimate, updateTaskEstimate, getAllTaskEstimates, learnFromActualTime } from '../task-estimates';

describe('getTaskEstimate', () => {
  test('should return exact estimate for known task', () => {
    const estimate = getTaskEstimate('Asset Master');
    expect(estimate).toBe(120);
  });

  test('should return partial match estimate (case-insensitive)', () => {
    const estimate = getTaskEstimate('asset api implementation');
    expect(estimate).toBe(60); // Matches 'Asset API'
  });

  test('should return default 60 minutes for unknown task', () => {
    const estimate = getTaskEstimate('Unknown Feature X');
    expect(estimate).toBe(60);
  });

  test('should match phase notation tasks', () => {
    const estimate = getTaskEstimate('Travel Phase 1');
    expect(estimate).toBe(120);
  });

  test('should return estimate for all predefined tasks', () => {
    const tasks = [
      'Asset Master',
      'Backup App',
      'Travel Management',
      'Audit System',
      'Phase 1-1',
    ];

    tasks.forEach((task) => {
      const estimate = getTaskEstimate(task);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(180);
    });
  });
});

describe('updateTaskEstimate', () => {
  test('should update existing task estimate', () => {
    const originalEstimate = getTaskEstimate('Asset Master');
    updateTaskEstimate('Asset Master', 150);
    const updatedEstimate = getTaskEstimate('Asset Master');

    expect(updatedEstimate).toBe(150);

    // Restore for other tests
    updateTaskEstimate('Asset Master', originalEstimate);
  });

  test('should add new task estimate', () => {
    const newTaskName = 'Custom Task New';
    updateTaskEstimate(newTaskName, 90);
    const estimate = getTaskEstimate(newTaskName);

    expect(estimate).toBe(90);
  });

  test('should support dynamic updates', () => {
    const testTask = 'Dynamic Test Task';
    updateTaskEstimate(testTask, 45);
    expect(getTaskEstimate(testTask)).toBe(45);

    updateTaskEstimate(testTask, 75);
    expect(getTaskEstimate(testTask)).toBe(75);
  });
});

describe('getAllTaskEstimates', () => {
  test('should return all registered estimates', () => {
    const allEstimates = getAllTaskEstimates();

    expect(typeof allEstimates).toBe('object');
    expect(Object.keys(allEstimates).length).toBeGreaterThan(20);
  });

  test('should include all major task categories', () => {
    const allEstimates = getAllTaskEstimates();

    expect(allEstimates['Asset Master']).toBe(120);
    expect(allEstimates['Backup App']).toBe(120);
    expect(allEstimates['Travel Management']).toBe(150);
    expect(allEstimates['Audit System']).toBe(180);
  });

  test('should return a copy (not reference)', () => {
    const estimates1 = getAllTaskEstimates();
    estimates1['Test Task'] = 999;

    const estimates2 = getAllTaskEstimates();
    expect(estimates2['Test Task']).toBeUndefined();
  });
});

describe('learnFromActualTime', () => {
  test('should average old estimate with actual time', () => {
    const testTask = 'Learning Test Task 1';
    updateTaskEstimate(testTask, 100);

    const newEstimate = learnFromActualTime(testTask, 60);

    // (100 + 60) / 2 = 80
    expect(newEstimate).toBe(80);
    expect(getTaskEstimate(testTask)).toBe(80);
  });

  test('should round to nearest minute', () => {
    const testTask = 'Learning Test Task 2';
    updateTaskEstimate(testTask, 100);

    const newEstimate = learnFromActualTime(testTask, 75);

    // (100 + 75) / 2 = 87.5 → 88 (rounded)
    expect(newEstimate).toBe(88);
  });

  test('should improve estimates over multiple iterations', () => {
    const testTask = 'Learning Test Task 3';
    updateTaskEstimate(testTask, 120);

    // Simulate task completion: takes 100 minutes
    let estimate = learnFromActualTime(testTask, 100);
    expect(estimate).toBe(110); // (120 + 100) / 2 = 110

    // Next iteration: actually took 105 minutes
    estimate = learnFromActualTime(testTask, 105);
    expect(estimate).toBe(108); // (110 + 105) / 2 = 107.5 → 108

    // Converges toward actual time over time
    expect(estimate).toBeLessThan(110);
    expect(estimate).toBeGreaterThan(100);
  });

  test('should persist learned estimates', () => {
    const testTask = 'Learning Test Task 4';
    updateTaskEstimate(testTask, 150);
    learnFromActualTime(testTask, 120);

    // Verify the learned estimate is stored
    const storedEstimate = getTaskEstimate(testTask);
    expect(storedEstimate).toBe(135); // (150 + 120) / 2 = 135
  });
});
