// app/api/travels/[id]/members/route.ts
// POST: 멤버 추가
// DELETE: 멤버 제거

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { TravelMember, ApiResponse } from '@/types/travel';

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

// POST: 멤버 추가
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
    const body = await request.json();
    const { user_id, role = 'companion', permission = 'read_write' } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required', status: 400 },
        { status: 400 }
      );
    }

    // Verify user is organizer
    const { data: travel, error: fetchError } = await supabase
      .from('travels')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !travel) {
      return NextResponse.json(
        { error: 'Travel not found', status: 404 },
        { status: 404 }
      );
    }

    if (travel.user_id !== userId) {
      return NextResponse.json(
        { error: 'Only organizer can add members', status: 403 },
        { status: 403 }
      );
    }

    // Check if member already exists
    const { data: existing } = await supabase
      .from('travel_members')
      .select('id')
      .eq('travel_id', id)
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member', status: 400 },
        { status: 400 }
      );
    }

    // Add member
    const { data: member, error: memberError } = await supabase
      .from('travel_members')
      .insert({
        travel_id: id,
        user_id,
        role,
        permission,
      })
      .select()
      .single();

    if (memberError) throw memberError;

    const response: ApiResponse<TravelMember> = {
      data: member as TravelMember,
      message: 'Member added successfully',
      status: 201,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error adding member:', error);
    return NextResponse.json(
      { error: 'Failed to add member', status: 500 },
      { status: 500 }
    );
  }
}

// DELETE: 멤버 제거
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
    const memberId = request.headers.get('x-member-id');

    if (!memberId) {
      return NextResponse.json(
        { error: 'member_id is required', status: 400 },
        { status: 400 }
      );
    }

    // Verify user is organizer
    const { data: travel } = await supabase
      .from('travels')
      .select('user_id')
      .eq('id', id)
      .single();

    if (travel?.user_id !== userId) {
      return NextResponse.json(
        { error: 'Only organizer can remove members', status: 403 },
        { status: 403 }
      );
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('travel_members')
      .delete()
      .eq('id', memberId)
      .eq('travel_id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      message: 'Member removed successfully',
      status: 200,
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member', status: 500 },
      { status: 500 }
    );
  }
}
