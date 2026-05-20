/**
 * Unit tests for git-parser utility
 * Validates commit parsing, stage extraction, and task name extraction
 */

import { parseGitCommits, extractTaskName } from '../git-parser';

describe('parseGitCommits', () => {
  test('should parse git log with Stage marker', () => {
    const gitLog = `abc1234|2026-05-18T14:45:00+09:00|feat(asset): API GET /assets implementation

Stage: API
Refs: asset-master-p2`;

    const result = parseGitCommits(gitLog);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      hash: 'abc1234',
      stage: 'API',
      taskName: 'Asset Master Phase 2',
    });
  });

  test('should extract stage from commit message', () => {
    const gitLog = `def5678|2026-05-18T15:00:00+09:00|chore(db): Add backup tables

Stage: DB
Refs: backup-phase-2`;

    const result = parseGitCommits(gitLog);

    expect(result[0].stage).toBe('DB');
  });

  test('should handle multiple commits', () => {
    const gitLog = `abc1234|2026-05-18T14:45:00+09:00|feat: Task 1
Stage: DESIGN
def5678|2026-05-18T14:55:00+09:00|feat: Task 2
Stage: API`;

    const result = parseGitCommits(gitLog);

    expect(result).toHaveLength(2);
    expect(result[0].stage).toBe('DESIGN');
    expect(result[1].stage).toBe('API');
  });

  test('should ignore commits without Stage marker', () => {
    const gitLog = `abc1234|2026-05-18T14:45:00+09:00|chore: Update README
def5678|2026-05-18T14:55:00+09:00|chore(ctb): Add test
Stage: API`;

    const result = parseGitCommits(gitLog);

    // Filter to stage commits only
    const stageCommits = result.filter((c) => c.stage);
    expect(stageCommits).toHaveLength(1);
  });
});

describe('extractTaskName', () => {
  test('should extract task name from Refs field', () => {
    const message = `feat(asset): API implementation

Refs: asset-master-p2`;

    const result = extractTaskName(message);
    expect(result).toBe('Asset Master Phase 2');
  });

  test('should extract task name from commit scope', () => {
    const message = 'feat(backup-module): Initialize backup system';
    const result = extractTaskName(message);
    expect(result).toBe('Backup Module');
  });

  test('should handle phase notation in Refs', () => {
    const message = 'chore: Deploy

Refs: travel-p1';

    const result = extractTaskName(message);
    expect(result).toBe('Travel Phase 1');
  });

  test('should return undefined for messages without task name', () => {
    const message = 'chore: Random commit message';
    const result = extractTaskName(message);
    expect(result).toBeUndefined();
  });
});
