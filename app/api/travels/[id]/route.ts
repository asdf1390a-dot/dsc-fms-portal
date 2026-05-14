// app/api/travels/[id]/route.ts
// GET: 여행 상세 정보 조회 (모든 관계 데이터 포함)
// PUT: 여행 정보 수정
// DELETE: 여행 삭제

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Travel, ApiResponse } from '@/types/travel';
import {
  hasReadAccess,
  isOrganizer,
  getTravelWithRelations,
  validateTravelDates,
} from '@/lib/travel/service';

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

// GET: 여행 상세 정보
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
    if (!(await hasReadAccess(supabase, userId, id))) {
      return NextResponse.json(
        { error: 'Access denied', status: 403 },
        { status: 403 }
      );
    }

    // Fetch travel with relations
    const travel = await getTravelWithRelations(supabase, id);

    const response: ApiResponse<Travel> = {
      data: travel as Travel,
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching travel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch travel', status: 500 },
      { status: 500 }
    );
  }
}

// PUT: 여행 정보 수정
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
    const body = await request.json();

    // Check if organizer
    const isOrg = await isOrganizer(supabase, userId, id);
    if (!isOrg) {
      return NextResponse.json(
        { error: 'Only organizer can modify travel', status: 403 },
        { status: 403 }
      );
    }

    // Validate dates if provided
    if (body.start_date && body.end_date) {
      const dateValidation = validateTravelDates(body.start_date, body.end_date);
      if (!dateValidation.valid) {
        return NextResponse.json(
          { error: dateValidation.error, status: 400 },
          { status: 400 }
        );
      }
    }

    // Update travel
    const { data: updated, error: updateError } = await supabase
      .from('travels')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const response: ApiResponse<Travel> = {
      data: updated as Travel,
      message: 'Travel updated successfully',
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating travel:', error);
    return NextResponse.json(
      { error: 'Failed to update travel', status: 500 },
      { status: 500 }
    );
  }
}

// DELETE: 여행 삭제
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

    // Check if organizer
    const isOrg = await isOrganizer(supabase, userId, id);
    if (!isOrg) {
      return NextResponse.json(
        { error: 'Only organizer can delete travel', status: 403 },
        { status: 403 }
      );
    }

    // Delete travel (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('travels')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      message: 'Travel deleted successfully',
      status: 200,
    });
  } catch (error) {
    console.error('Error deleting travel:', error);
    return NextResponse.json(
      { error: 'Failed to delete travel', status: 500 },
      { status: 500 }
    );
  }
}
