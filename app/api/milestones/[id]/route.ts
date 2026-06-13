// GET    /api/milestones/:id  — fetch a single milestone
// PUT    /api/milestones/:id  — update (auth required)
// DELETE /api/milestones/:id  — delete (auth required)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/team/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_STATUS = new Set(['pending', 'in_progress', 'completed', 'blocked'])

const UPDATABLE_FIELDS = [
  'project_id',
  'title',
  'description',
  'target_date',
  'status',
  'owner_id',
  'completion_date',
] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'not_found' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'internal_error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.reason || 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { data: existing, error: checkErr } = await supabase
      .from('milestones')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()
    if (checkErr) throw checkErr
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'not_found' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))

    // Accept camelCase aliases
    const aliased: Record<string, any> = {
      ...body,
      project_id: body.project_id ?? body.projectId,
      target_date: body.target_date ?? body.targetDate,
      owner_id: body.owner_id ?? body.ownerId,
      completion_date: body.completion_date ?? body.completionDate,
    }

    const update: Record<string, any> = {}
    for (const f of UPDATABLE_FIELDS) {
      if (aliased[f] !== undefined) update[f] = aliased[f]
    }

    if (update.status && !ALLOWED_STATUS.has(update.status)) {
      return NextResponse.json(
        { success: false, error: `invalid status; allowed: ${[...ALLOWED_STATUS].join(',')}` },
        { status: 400 }
      )
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: 'no_updatable_fields' },
        { status: 400 }
      )
    }

    // Auto-set completion_date when status flips to completed and not provided
    if (update.status === 'completed' && update.completion_date === undefined) {
      update.completion_date = new Date().toISOString().slice(0, 10)
    }

    const { data, error } = await supabase
      .from('milestones')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'internal_error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.reason || 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { data: existing, error: checkErr } = await supabase
      .from('milestones')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()
    if (checkErr) throw checkErr
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'not_found' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json(
      { success: true, message: 'deleted' },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'internal_error' },
      { status: 500 }
    )
  }
}
