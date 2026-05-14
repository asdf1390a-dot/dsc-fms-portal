// app/api/travels/route.ts
// GET: 사용자의 여행 목록 조회
// POST: 새 여행 생성

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Travel, ApiResponse, ApiResponseList } from '@/types/travel';
import { getUserTravels, validateTravelDates } from '@/lib/travel/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

// GET: 여행 목록 조회
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'upcoming' | 'ongoing' | 'completed' | null;
    const sortBy = (searchParams.get('sort_by') as 'date' | 'cost' | 'name') || 'date';

    const travels = await getUserTravels(
      supabase,
      userId,
      status || undefined,
      sortBy
    );

    const response: ApiResponseList<Travel> = {
      data: travels,
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching travels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch travels', status: 500 },
      { status: 500 }
    );
  }
}

// POST: 새 여행 생성
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, start_date, end_date, location } = body;

    // Validate required fields
    if (!name || !start_date || !end_date || !location) {
      return NextResponse.json(
        { error: 'name, start_date, end_date, and location are required', status: 400 },
        { status: 400 }
      );
    }

    // Validate date range
    const dateValidation = validateTravelDates(start_date, end_date);
    if (!dateValidation.valid) {
      return NextResponse.json(
        { error: dateValidation.error, status: 400 },
        { status: 400 }
      );
    }

    // Create travel
    const { data: travel, error: travelError } = await supabase
      .from('travels')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        start_date,
        end_date,
        location,
        status: 'upcoming',
      })
      .select()
      .single();

    if (travelError) throw travelError;

    // Add organizer as member
    const { error: memberError } = await supabase
      .from('travel_members')
      .insert({
        travel_id: travel.id,
        user_id: userId,
        role: 'organizer',
        permission: 'read_write',
      });

    if (memberError) throw memberError;

    // Create default notification rules
    const defaultRules = [
      {
        travel_id: travel.id,
        rule_type: 'travel_starting_soon',
        rule_config: { days_before: 7 },
        is_enabled: true,
      },
      {
        travel_id: travel.id,
        rule_type: 'travel_started',
        rule_config: {},
        is_enabled: true,
      },
      {
        travel_id: travel.id,
        rule_type: 'travel_ended',
        rule_config: {},
        is_enabled: true,
      },
    ];

    await supabase.from('travel_notification_rules').insert(defaultRules);

    const response: ApiResponse<Travel> = {
      data: travel as Travel,
      message: 'Travel created successfully',
      status: 201,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating travel:', error);
    return NextResponse.json(
      { error: 'Failed to create travel', status: 500 },
      { status: 500 }
    );
  }
}
