/**
 * Git commit parsing utilities for CTB real-time updates
 * Extracts Stage markers, task names, and timestamps from commit messages
 */

interface ParsedCommit {
  hash: string;
  timestamp: string;
  message: string;
  stage?: string;
  taskName?: string;
}

/**
 * Parse git log output and extract commit information
 * Expected format: "HASH|ISO_TIMESTAMP|COMMIT_MESSAGE"
 */
export function parseGitCommits(gitLog: string): ParsedCommit[] {
  const lines = gitLog.trim().split('\n').filter((line) => line.length > 0);

  return lines.map((line) => {
    const [hash, timestamp, ...messageParts] = line.split('|');
    const message = messageParts.join('|'); // Rejoin in case message contains |

    const commit: ParsedCommit = {
      hash: hash?.trim() || '',
      timestamp: timestamp?.trim() || '',
      message: message?.trim() || '',
    };

    // Extract Stage marker
    const stageMatch = message.match(/Stage:\s*(DESIGN|DB|API|UI|DEPLOY|VERIFY)/i);
    if (stageMatch) {
      commit.stage = stageMatch[1].toUpperCase();
    }

    // Extract task name from commit message or Refs field
    const taskName = extractTaskName(message);
    if (taskName) {
      commit.taskName = taskName;
    }

    return commit;
  });
}

/**
 * Extract task name from commit message
 * Looks for: commit message prefix OR Refs: field
 * Examples:
 * - "feat(asset): API GET /assets implementation" → "Asset API"
 * - "Refs: asset-master-p2" → "Asset Master Phase 2"
 */
export function extractTaskName(message: string): string | undefined {
  // Try to extract from Refs field first (most reliable)
  const refsMatch = message.match(/Refs:\s*([a-zA-Z0-9\-_]+)/i);
  if (refsMatch) {
    const refId = refsMatch[1];
    return humanizeRefId(refId);
  }

  // Fallback: extract from commit message prefix (feat/fix/chore etc)
  const scopeMatch = message.match(/^(?:feat|fix|chore|docs|refactor|test|perf)\(([^)]+)\):/i);
  if (scopeMatch) {
    const scope = scopeMatch[1];
    return humanizeScope(scope);
  }

  return undefined;
}

/**
 * Convert kebab-case ref ID to human-readable format
 * Examples: "asset-master-p2" → "Asset Master Phase 2"
 */
function humanizeRefId(refId: string): string {
  return refId
    .split('-')
    .map((word) => {
      // Handle special cases
      if (word === 'p1' || word === 'p2' || word === 'p3') {
        return `Phase ${word[1]}`;
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Convert scope to human-readable format
 * Examples: "asset" → "Asset", "user-auth" → "User Auth"
 */
function humanizeScope(scope: string): string {
  return scope
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract commit info and validate timestamp
 */
export function extractCommitInfo(commit: ParsedCommit): {
  isValid: boolean;
  hash: string;
  stage?: string;
  taskName?: string;
  timestamp: Date;
} {
  const timestamp = new Date(commit.timestamp);
  const isValid = !isNaN(timestamp.getTime()) && commit.stage !== undefined;

  return {
    isValid,
    hash: commit.hash,
    stage: commit.stage,
    taskName: commit.taskName,
    timestamp,
  };
}
