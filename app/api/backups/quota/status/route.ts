import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const status = await getQuotaStatus(supabase, userId);
    return NextResponse.json({ data: status, status: 200 });
  } catch (error) {
    console.error('Error fetching quota status:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
