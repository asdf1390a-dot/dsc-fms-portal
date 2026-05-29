// GET /api/activity-log/:memberId  — activity entries for a single member
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const sp = new URL(request.url).searchParams
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(sp.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    )
    const activityType = sp.get('type') || sp.get('activity_type')

    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('member_id', params.memberId)

    if (activityType) query = query.eq('activity_type', activityType)

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json(
      { success: true, data: data || [] },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
