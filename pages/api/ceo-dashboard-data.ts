import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface DashboardDataResponse {
  markdown: string;
  timestamp: string;
  success: boolean;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardDataResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Path to active_work_tracking.md in workspace
    const ctbPath = path.join(
      process.cwd(),
      '..',
      '..',
      'workspace-dev',
      'memory',
      'active_work_tracking.md'
    );

    // Read the file
    const markdown = fs.readFileSync(ctbPath, 'utf-8');

    res.status(200).json({
      markdown,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Failed to read CTB file:', error);
    res.status(500).json({
      error: 'Failed to read dashboard data',
    });
  }
}
