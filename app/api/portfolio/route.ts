// GET  /api/portfolio  — list portfolio items
//   Query: ?memberId=&status=&limit=&offset=
// POST /api/portfolio  — create a portfolio item (auth required)
//   Body: { member_id, project_name, description?, role?, start_date?, end_date?,
//           status?, image_url?, skills_used?: string[], impact? }
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/team/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_STATUS = new Set(['planning', 'in_progress', 'completed', 'on_hold'])

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const memberId = url.searchParams.get('memberId') || url.searchParams.get('member_id')
    const status = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0

    let q = supabase
      .from('portfolio_items')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (memberId) q = q.eq('member_id', memberId)
    if (status) q = q.eq('status', status)

    const { data, error, count } = await q
    if (error) throw error

    return NextResponse.json(
      { success: true, data: data || [], count: count ?? (data?.length || 0), limit, offset },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'internal_error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.reason || 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const memberId = body.member_id ?? body.memberId
    const projectName = body.project_name ?? body.projectName

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'member_id is required' },
        { status: 400 }
      )
    }
    if (!projectName) {
      return NextResponse.json(
        { success: false, error: 'project_name is required' },
        { status: 400 }
      )
    }

    const status = body.status ?? 'in_progress'
    if (status && !ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { success: false, error: `invalid status; allowed: ${[...ALLOWED_STATUS].join(',')}` },
        { status: 400 }
      )
    }

    const payload: Record<string, any> = {
      member_id: memberId,
      project_name: projectName,
      description: body.description ?? null,
      role: body.role ?? null,
      start_date: body.start_date ?? body.startDate ?? null,
      end_date: body.end_date ?? body.endDate ?? null,
      status,
      image_url: body.image_url ?? body.imageUrl ?? null,
      skills_used: Array.isArray(body.skills_used ?? body.skillsUsed)
        ? (body.skills_used ?? body.skillsUsed)
        : null,
      impact: body.impact ?? null,
    }

    const { data, error } = await supabase
      .from('portfolio_items')
      .insert([payload])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'internal_error' },
      { status: 500 }
    )
  }
}
