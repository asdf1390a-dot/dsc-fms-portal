import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { TravelChecklistItem, ApiResponse, ApiResponseList } from '@/types/travel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAccess(userId: string, travelId: string): Promise<boolean> {
  const { data: travel } = await supabase
    .from('travels')
    .select('user_id')
    .eq('id', travelId)
    .single();
  if (!travel) return false;
  if (travel.user_id === userId) return true;
  const { data: member } = await supabase
    .from('travel_members')
    .select('id')
    .eq('travel_id', travelId)
    .eq('user_id', userId)
    .single();
  return !!member;
}

async function checkWritePermission(userId: string, travelId: string): Promise<boolean> {
  const { data: travel } = await supabase
    .from('travels')
    .select('user_id')
    .eq('id', travelId)
    .single();
  if (travel?.user_id === userId) return true;
  const { data: member } = await supabase
    .from('travel_members')
    .select('permission')
    .eq('travel_id', travelId)
    .eq('user_id', userId)
    .single();
  return member?.permission === 'read_write';
}

interface RouteParams { params: { id: string } }

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || !(await checkAccess(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { data, error } = await supabase
      .from('travel_checklist_items')
      .select('*')
      .eq('travel_id', params.id)
      .order('category');
    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch checklist', status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || !(await checkWritePermission(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { title, category, priority, notes } = await request.json();
    if (!title) {
      return NextResponse.json({ error: 'Title is required', status: 400 }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('travel_checklist_items')
      .insert({ travel_id: params.id, title, category, priority, notes, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data, message: 'Item created', status: 201 }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create item', status: 500 }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const itemId = request.headers.get('x-item-id');
    if (!userId || !itemId || !(await checkWritePermission(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const body = await request.json();
    const { data, error } = await supabase
      .from('travel_checklist_items')
      .update(body)
      .eq('id', itemId)
      .eq('travel_id', params.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data, message: 'Item updated', status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item', status: 500 }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const itemId = request.headers.get('x-item-id');
    if (!userId || !itemId || !(await checkWritePermission(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { error } = await supabase
      .from('travel_checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('travel_id', params.id);
    if (error) throw error;
    return NextResponse.json({ message: 'Item deleted', status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item', status: 500 }, { status: 500 });
  }
}
