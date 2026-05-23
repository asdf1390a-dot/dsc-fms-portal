import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromToken, isTokenExpired } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const VALID_EVENT_TYPES = ['backup', 'storage', 'integrity', 'access'];
const VALID_STATUSES = ['success', 'warning', 'failure'];

// POST /api/audit/issue — manually record an audit event
// Body: { event_type, status, score?, details? }
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }
    if (isTokenExpired(token)) {
      return NextResponse.json(
        { success: false, error: { message: 'Token expired' } },
        { status: 401 }
      );
    }
    const userId = getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid token' } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { event_type, status, score, details } = body || {};

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `event_type must be one of ${VALID_EVENT_TYPES.join(', ')}`,
            field: 'event_type',
          },
        },
        { status: 400 }
      );
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `status must be one of ${VALID_STATUSES.join(', ')}`,
            field: 'status',
          },
        },
        { status: 400 }
      );
    }
    if (
      score !== undefined &&
      score !== null &&
      (!Number.isInteger(score) || score < 0 || score > 100)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'score must be integer 0-100', field: 'score' },
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('audit_event_logs')
      .insert([
        {
          event_type,
          status,
          score: score ?? null,
          details: {
            ...(details || {}),
            reported_by: userId,
            source: 'manual',
          },
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Server error',
        },
      },
      { status: 500 }
    );
  }
}
