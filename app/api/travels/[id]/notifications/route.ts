import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

interface RouteParams { params: { id: string } }

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || !(await checkAccess(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { data, error } = await supabase
      .from('travel_notifications')
      .select('*')
      .eq('travel_id', params.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notifications', status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || !(await checkAccess(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { title, message, channels } = await request.json();
    const { data, error } = await supabase
      .from('travel_notifications')
      .insert({
        travel_id: params.id,
        user_id: userId,
        notification_type: 'custom',
        title,
        message,
        channels,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data, message: 'Notification created', status: 201 }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create notification', status: 500 }, { status: 500 });
  }
}
