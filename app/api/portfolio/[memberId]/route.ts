// GET  /api/portfolio/:memberId  — portfolio for a single member
// POST /api/portfolio/:memberId  — add a portfolio item to that member (auth)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/team/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('member_id', params.memberId)
      .order('created_at', { ascending: false })

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

export async function POST(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const auth = authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.reason || 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const projectName = body.project_name ?? body.projectName
    if (!projectName) {
      return NextResponse.json(
        { success: false, error: 'project_name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('portfolio_items')
      .insert([
        {
          member_id: params.memberId,
          project_name: projectName,
          description: body.description ?? null,
          role: body.role ?? null,
          start_date: body.start_date ?? body.startDate ?? null,
          end_date: body.end_date ?? body.endDate ?? null,
          status: body.status ?? 'in_progress',
          image_url: body.image_url ?? body.imageUrl ?? null,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
