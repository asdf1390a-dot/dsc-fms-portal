// GET    /api/portfolio/item/:id  — fetch a single portfolio item
// PUT    /api/portfolio/item/:id  — update (auth required)
// DELETE /api/portfolio/item/:id  — delete (auth required)
//
// NOTE: The existing route `/api/portfolio/:memberId` lists/creates items
// scoped to a member. To avoid breaking that contract we expose per-item
// operations under `/api/portfolio/item/:id`.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/team/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_STATUS = new Set(['planning', 'in_progress', 'completed', 'on_hold'])

const UPDATABLE_FIELDS = [
  'project_name',
  'description',
  'role',
  'start_date',
  'end_date',
  'status',
  'image_url',
  'skills_used',
  'impact',
] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('portfolio_items')
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
      .from('portfolio_items')
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
      project_name: body.project_name ?? body.projectName,
      start_date: body.start_date ?? body.startDate,
      end_date: body.end_date ?? body.endDate,
      image_url: body.image_url ?? body.imageUrl,
      skills_used: body.skills_used ?? body.skillsUsed,
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

    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('portfolio_items')
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
      .from('portfolio_items')
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
      .from('portfolio_items')
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
