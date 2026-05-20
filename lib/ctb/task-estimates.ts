/**
 * Task estimate mappings for CTB time delta calculation
 * Maps task names to estimated completion time in minutes
 */

interface TaskEstimateMap {
  [key: string]: number;
}

const TASK_ESTIMATE_MAP: TaskEstimateMap = {
  // Asset Master estimates
  'Asset Master': 120,
  'Asset Master Phase 1': 120,
  'Asset Master Phase 2': 120,
  'Asset API': 60,
  'Asset UI': 90,
  'Asset Import': 75,
  'Asset Export': 45,

  // Backup App estimates
  'Backup App': 120,
  'Backup Phase 1': 90,
  'Backup Phase 2': 150,
  'Backup Automation': 120,
  'Backup Metrics': 60,
  'Backup Schedule': 45,

  // Travel Management estimates
  'Travel Management': 150,
  'Travel Phase 1': 120,
  'Travel Phase 2': 150,
  'Travel UI': 90,
  'Travel API': 120,
  'Travel Voucher Parsing': 75,

  // Audit System estimates
  'Audit System': 180,
  'Audit Framework': 120,
  'Audit Reporting': 90,
  'Audit Automation': 60,

  // CTB Real-time estimates
  'Phase 1-1': 120,
  'Phase 1-2': 90,
  'Phase 1-3': 120,
  'Phase 1-4': 150,

  // Default
  'Unknown Task': 60,
};

/**
 * Get estimated minutes for a task
 * Returns default 60 minutes if task not found
 */
export function getTaskEstimate(taskName: string): number {
  // Try exact match first
  if (TASK_ESTIMATE_MAP[taskName]) {
    return TASK_ESTIMATE_MAP[taskName];
  }

  // Try partial match (case-insensitive)
  for (const [key, value] of Object.entries(TASK_ESTIMATE_MAP)) {
    if (taskName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return default if no match
  return TASK_ESTIMATE_MAP['Unknown Task'];
}

/**
 * Register or update task estimate
 * Useful for dynamic updates based on historical data
 */
export function updateTaskEstimate(taskName: string, estimatedMinutes: number): void {
  TASK_ESTIMATE_MAP[taskName] = estimatedMinutes;
}

/**
 * Get all registered task estimates
 */
export function getAllTaskEstimates(): TaskEstimateMap {
  return { ...TASK_ESTIMATE_MAP };
}

/**
 * Adjust estimate based on actual time (for learning)
 * Average the new actual time with existing estimate: new_est = (old_est + actual_time) / 2
 */
export function learnFromActualTime(taskName: string, actualMinutes: number): number {
  const currentEstimate = getTaskEstimate(taskName);
  const newEstimate = Math.round((currentEstimate + actualMinutes) / 2);
  updateTaskEstimate(taskName, newEstimate);
  return newEstimate;
}
