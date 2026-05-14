import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { approveWeeklyReport } from '@/lib/weekly-reports/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { approved_by_user } = body;

    const userId = approved_by_user || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', status: 401 },
        { status: 401 }
      );
    }

    // Verify user is admin
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found', status: 401 },
        { status: 401 }
      );
    }

    const role = user.raw_user_meta_data?.role;
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can approve reports', status: 403 },
        { status: 403 }
      );
    }

    const result = await approveWeeklyReport(supabase, params.id, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error approving weekly report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve weekly report', status: 500 },
      { status: 500 }
    );
  }
}
