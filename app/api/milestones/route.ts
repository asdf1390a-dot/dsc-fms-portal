// GET  /api/milestones  — list milestones
//   Query: ?project_id=&status=&owner_id=&limit=&offset=
// POST /api/milestones  — create a milestone (auth required)
//   Body: { project_id?, title, description?, target_date, status?,
//           owner_id?, completion_date? }
//
// Schema reference: db/36_team_dashboard_phase2.sql
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/team/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_STATUS = new Set(['pending', 'in_progress', 'completed', 'blocked'])

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('projectId')
    const status = url.searchParams.get('status')
    const ownerId = url.searchParams.get('owner_id') || url.searchParams.get('ownerId')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0

    let q = supabase
      .from('milestones')
      .select('*', { count: 'exact' })
      .order('target_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (projectId) q = q.eq('project_id', projectId)
    if (status) q = q.eq('status', status)
    if (ownerId) q = q.eq('owner_id', ownerId)

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
    const title = body.title
    const targetDate = body.target_date ?? body.targetDate

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      )
    }
    if (!targetDate) {
      return NextResponse.json(
        { success: false, error: 'target_date is required' },
        { status: 400 }
      )
    }

    const status = body.status ?? 'pending'
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { success: false, error: `invalid status; allowed: ${[...ALLOWED_STATUS].join(',')}` },
        { status: 400 }
      )
    }

    const payload: Record<string, any> = {
      project_id: body.project_id ?? body.projectId ?? null,
      title,
      description: body.description ?? null,
      target_date: targetDate,
      status,
      owner_id: body.owner_id ?? body.ownerId ?? auth.user?.sub ?? null,
      completion_date: body.completion_date ?? body.completionDate ?? null,
    }

    const { data, error } = await supabase
      .from('milestones')
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
