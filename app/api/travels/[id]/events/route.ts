// app/api/travels/[id]/events/route.ts
// POST: 이벤트 추가
// GET: 이벤트 목록 조회 (날짜순 정렬)
// PUT: 이벤트 수정
// DELETE: 이벤트 삭제

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { TravelEvent, ApiResponse, ApiResponseList } from '@/types/travel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

// Helper: Check if user has write permission
async function checkWritePermission(
  userId: string,
  travelId: string
): Promise<boolean> {
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

// Helper: Check if user has access
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

// GET: 이벤트 목록
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check access
    if (!(await checkAccess(userId, id))) {
      return NextResponse.json(
        { error: 'Access denied', status: 403 },
        { status: 403 }
      );
    }

    const { data: events, error } = await supabase
      .from('travel_events')
      .select('*')
      .eq('travel_id', id)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    if (error) throw error;

    const response: ApiResponseList<TravelEvent> = {
      data: events as TravelEvent[],
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', status: 500 },
      { status: 500 }
    );
  }
}

// POST: 이벤트 추가
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check write permission
    if (!(await checkWritePermission(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have write permission', status: 403 },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      event_type,
      event_date,
      event_time,
      location,
      description,
      details,
    } = body;

    if (!title || !event_type || !event_date) {
      return NextResponse.json(
        { error: 'Missing required fields', status: 400 },
        { status: 400 }
      );
    }

    const { data: event, error } = await supabase
      .from('travel_events')
      .insert({
        travel_id: id,
        title,
        event_type,
        event_date,
        event_time: event_time || null,
        location: location || null,
        description: description || null,
        details: details || {},
        status: 'planned',
      })
      .select()
      .single();

    if (error) throw error;

    const response: ApiResponse<TravelEvent> = {
      data: event as TravelEvent,
      message: 'Event created successfully',
      status: 201,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event', status: 500 },
      { status: 500 }
    );
  }
}

// PUT: 이벤트 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;
    const eventId = request.headers.get('x-event-id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'event_id is required', status: 400 },
        { status: 400 }
      );
    }

    // Check write permission
    if (!(await checkWritePermission(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have write permission', status: 403 },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { data: event, error } = await supabase
      .from('travel_events')
      .update(body)
      .eq('id', eventId)
      .eq('travel_id', id)
      .select()
      .single();

    if (error) throw error;

    const response: ApiResponse<TravelEvent> = {
      data: event as TravelEvent,
      message: 'Event updated successfully',
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event', status: 500 },
      { status: 500 }
    );
  }
}

// DELETE: 이벤트 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;
    const eventId = request.headers.get('x-event-id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'event_id is required', status: 400 },
        { status: 400 }
      );
    }

    // Check write permission
    if (!(await checkWritePermission(userId, id))) {
      return NextResponse.json(
        { error: 'You do not have write permission', status: 403 },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('travel_events')
      .delete()
      .eq('id', eventId)
      .eq('travel_id', id);

    if (error) throw error;

    return NextResponse.json({
      message: 'Event deleted successfully',
      status: 200,
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event', status: 500 },
      { status: 500 }
    );
  }
}
