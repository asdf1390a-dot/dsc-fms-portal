import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseGitCommits, extractCommitInfo } from '@/lib/ctb/git-parser';
import { calculateTimeDelta, formatTimeDelta, formatETAChange } from '@/lib/ctb/time-delta';
import { sendTelegramNotification } from '@/lib/ctb/telegram-notifier';
import { getTaskEstimate } from '@/lib/ctb/task-estimates';
import { findNextTask, updateTaskETA, calcETAChange } from '@/lib/ctb/eta-calculator';

export const dynamic = 'force-dynamic';

interface ParsedCommit {
  hash: string;
  timestamp: string;
  message: string;
  stage?: string;
  taskName?: string;
}

interface CTBLogEntry {
  date: string;
  taskName: string;
  estimated: number;
  actual: number;
  timeDelta: number;
  originalEta: string;
  newEta: string;
  completed: boolean;
}

export async function POST(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get recent git commits (last 50)
    const gitLog = execSync('git log --oneline -50 --format="%H|%ai|%s"', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });

    const commits: ParsedCommit[] = parseGitCommits(gitLog);
    const stageCommits = commits.filter((c) => c.stage);

    if (stageCommits.length === 0) {
      return NextResponse.json({
        message: 'No stage markers found',
        processedCommits: 0,
        status: 200,
      });
    }

    // Read existing CTB log
    const ctbPath = join(process.cwd(), 'memory', 'active_work_tracking.md');
    let ctbContent = readFileSync(ctbPath, 'utf-8');

    // Track new entries added
    let newEntriesCount = 0;
    const processedCommits: string[] = [];

    // Process each stage commit
    for (let i = 0; i < stageCommits.length; i++) {
      const commit = stageCommits[i];
      const taskName = commit.taskName || 'Unknown Task';

      // Check if commit already exists in CTB log
      if (ctbContent.includes(commit.hash)) {
        continue; // Skip already-logged commits
      }

      // Get timestamp of this commit
      const commitTime = new Date(commit.timestamp);
      const formattedTime = commitTime.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Get task estimate and calculate time delta
      const estimatedMinutes = getTaskEstimate(taskName);
      let actualMinutes = 0;
      let timeDelta = 0;
      let isAccelerated = false;

      if (i > 0) {
        const prevCommit = stageCommits[i - 1];
        const prevTime = new Date(prevCommit.timestamp);
        const result = calculateTimeDelta(commitTime, prevTime, estimatedMinutes);
        actualMinutes = result.actualMinutes;
        timeDelta = result.timeDelta;
        isAccelerated = result.isAccelerated;
      }

      const timeDeltaStr = formatTimeDelta(timeDelta);

      // Phase 1-3: ETA adjustment when ahead of schedule
      let scheduleAccelerationInfo: {
        nextTaskName: string;
        originalETA: string;
        newETA: string;
        minutesPulled: number;
      } | null = null;

      if (isAccelerated && timeDelta > 0) {
        const nextTask = findNextTask(ctbContent, taskName);
        if (nextTask) {
          // Create new ETA by pulling forward by time delta
          const originalETADate = new Date();
          const [hours, minutes] = nextTask.eta.split(':').map(Number);
          originalETADate.setHours(hours, minutes, 0, 0);

          const newETADate = new Date(originalETADate.getTime() - timeDelta * 60000);
          const newETAStr = newETADate.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Update CTB with new ETA for next task
          ctbContent = updateTaskETA(ctbContent, nextTask.taskName, newETADate);

          scheduleAccelerationInfo = {
            nextTaskName: nextTask.taskName,
            originalETA: nextTask.eta,
            newETA: newETAStr,
            minutesPulled: timeDelta,
          };
        }
      }

      // Create new CTB log entry with time delta calculation
      const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
      const newEntry = `| ${today} | ${taskName} | ${estimatedMinutes} | ${actualMinutes} | ${timeDeltaStr} | — | — | ✅ |`;

      // Find insertion point in event-driven log section
      const eventLogStart = ctbContent.indexOf('## 실시간 작업 완료 로그 (Event-Driven Updates)');
      if (eventLogStart === -1) {
        continue; // Event-driven log section not found
      }

      // Find the table start after the header
      const tableStart = ctbContent.indexOf('|', eventLogStart);
      const nextNewline = ctbContent.indexOf('\n', tableStart);
      const insertionPoint = ctbContent.indexOf('\n', nextNewline) + 1;

      // Insert new entry
      ctbContent =
        ctbContent.slice(0, insertionPoint) +
        newEntry +
        '\n' +
        ctbContent.slice(insertionPoint);

      newEntriesCount++;
      processedCommits.push(commit.hash);

      // Send Telegram notification
      try {
        await sendTelegramNotification({
          taskName,
          stage: commit.stage,
          completionTime: formattedTime,
          commitHash: commit.hash.slice(0, 7),
          estimatedMinutes,
          actualMinutes,
          timeDelta,
          isAccelerated,
          ...(scheduleAccelerationInfo && {
            nextTaskName: scheduleAccelerationInfo.nextTaskName,
            originalETA: scheduleAccelerationInfo.originalETA,
            newETA: scheduleAccelerationInfo.newETA,
            minutesPulled: scheduleAccelerationInfo.minutesPulled,
          }),
        });
      } catch (notificationError) {
        console.error('Failed to send Telegram notification:', notificationError);
        // Continue processing even if notification fails
      }
    }

    // Write updated CTB log
    if (newEntriesCount > 0) {
      writeFileSync(ctbPath, ctbContent, 'utf-8');
    }

    return NextResponse.json({
      message: `Processed ${stageCommits.length} stage commits, added ${newEntriesCount} new entries`,
      processedCommits,
      newEntriesCount,
      status: 200,
    });
  } catch (error) {
    console.error('Error in CTB realtime update cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
