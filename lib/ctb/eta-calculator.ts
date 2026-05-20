/**
 * ETA adjustment and schedule pulling logic for CTB real-time updates
 * Phase 1-3: Adjust next task ETA when current task completes ahead of schedule
 */

import { formatETAString, parseETAString } from './time-delta';

/**
 * CTB table entry interface
 */
interface CTBEntry {
  date: string;
  taskName: string;
  estimatedMinutes: number;
  actualMinutes: number;
  timeDelta: string;
  originalETA: string;
  newETA: string;
  status: string;
}

/**
 * Find next incomplete task in CTB
 * Returns the first task without a new ETA (not yet adjusted)
 */
export function findNextTask(
  ctbContent: string,
  currentTaskName: string
): { taskName: string; eta: string; assignee?: string } | null {
  const lines = ctbContent.split('\n');
  const tableStartIndex = lines.findIndex((line) => line.includes('| 날짜 | 작업명'));

  if (tableStartIndex === -1) return null;

  const dataLines = lines.slice(tableStartIndex + 2); // Skip header and separator
  let foundCurrent = false;

  for (const line of dataLines) {
    // Skip empty lines and separator lines
    if (!line.trim() || line.includes('---')) continue;
    if (!line.includes('|')) continue;

    const columns = line.split('|').map((col) => col.trim()).filter(Boolean);
    if (columns.length < 7) continue;

    const taskName = columns[1];
    const newETA = columns[6];
    const status = columns[7];

    // Skip the current task
    if (taskName.includes(currentTaskName) || foundCurrent === false) {
      if (taskName.includes(currentTaskName)) {
        foundCurrent = true;
      }
      continue;
    }

    // Found next task with empty new ETA (not yet adjusted)
    if (foundCurrent && newETA === '—') {
      const originalETA = columns[5];
      return {
        taskName: taskName.trim(),
        eta: originalETA.trim(),
      };
    }
  }

  return null;
}

/**
 * Extract scheduled ETA from CTB entry (original ETA column)
 */
export function extractScheduledETA(ctbEntry: string): Date | null {
  // ctbEntry is a markdown table row, parse it
  const columns = ctbEntry.split('|').map((col) => col.trim()).filter(Boolean);

  if (columns.length < 6) return null;

  // Original ETA is in column 5 (0-indexed)
  const etaStr = columns[5];

  if (!etaStr || etaStr === '—') return null;

  return parseETAString(etaStr);
}

/**
 * Update task ETA in CTB content
 * Finds the task row and updates the new ETA column while maintaining markdown format
 */
export function updateTaskETA(
  ctbContent: string,
  taskName: string,
  newETA: Date
): string {
  const lines = ctbContent.split('\n');
  const newETAStr = formatETAString(newETA);
  let updated = false;

  const updatedLines = lines.map((line) => {
    if (updated || !line.includes(taskName) || !line.includes('|')) {
      return line;
    }

    const columns = line.split('|');
    if (columns.length < 8) {
      return line;
    }

    // columns[0] is empty, so actual columns start at index 1
    // Column structure: | date | taskName | est | actual | delta | origETA | newETA | status |
    // Update column at index 6 (newETA)
    columns[6] = ` ${newETAStr} `;
    updated = true;

    return columns.join('|');
  });

  return updatedLines.join('\n');
}

/**
 * Calculate how many minutes were pulled forward
 */
export function calcETAChange(
  oldETA: Date,
  newETA: Date
): { minutesPulled: number; changed: boolean } {
  const minutesPulled = Math.round((oldETA.getTime() - newETA.getTime()) / 60000);

  return {
    minutesPulled: Math.max(0, minutesPulled),
    changed: minutesPulled > 0,
  };
}

/**
 * Parse a CTB table row and return structured data
 */
export function parseCTBEntry(line: string): CTBEntry | null {
  const columns = line.split('|').map((col) => col.trim()).filter(Boolean);

  if (columns.length < 8) return null;

  // Validate numeric columns
  const estimatedMinutes = parseInt(columns[2], 10);
  const actualMinutes = parseInt(columns[3], 10);

  if (isNaN(estimatedMinutes) || isNaN(actualMinutes)) return null;

  return {
    date: columns[0],
    taskName: columns[1],
    estimatedMinutes,
    actualMinutes,
    timeDelta: columns[4],
    originalETA: columns[5],
    newETA: columns[6],
    status: columns[7],
  };
}

/**
 * Check if a task is complete (has status marker)
 */
export function isTaskComplete(ctbEntry: CTBEntry): boolean {
  return ctbEntry.status.includes('✅') || ctbEntry.newETA !== '—';
}

/**
 * Get all incomplete tasks in CTB
 */
export function getIncompleteTasks(ctbContent: string): CTBEntry[] {
  const lines = ctbContent.split('\n');
  const tableStartIndex = lines.findIndex((line) => line.includes('| 날짜 | 작업명'));

  if (tableStartIndex === -1) return [];

  const dataLines = lines.slice(tableStartIndex + 2);
  const incompleteTasks: CTBEntry[] = [];

  for (const line of dataLines) {
    if (!line.trim() || line.includes('---') || !line.includes('|')) continue;

    const entry = parseCTBEntry(line);
    if (entry && !isTaskComplete(entry)) {
      incompleteTasks.push(entry);
    }
  }

  return incompleteTasks;
}
