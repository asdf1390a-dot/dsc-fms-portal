import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addWeeklyComment, getWeeklyComments } from '@/lib/weekly-reports/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const dept = searchParams.get('department');

    const result = await getWeeklyComments(supabase, params.id, dept || undefined);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comments', status: 500 },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      department,
      comment_type,
      content,
      author_name,
    } = body;

    // Validation
    if (!department || !comment_type || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: department, comment_type, content', status: 400 },
        { status: 400 }
      );
    }

    const validCommentTypes = ['interpretation', 'finding', 'action', 'note'];
    if (!validCommentTypes.includes(comment_type)) {
      return NextResponse.json(
        { error: `Invalid comment_type. Must be one of: ${validCommentTypes.join(', ')}`, status: 400 },
        { status: 400 }
      );
    }

    const userId = request.headers.get('x-user-id');

    const result = await addWeeklyComment(
      supabase,
      params.id,
      department,
      comment_type,
      content,
      userId || undefined,
      author_name
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add comment', status: 500 },
      { status: 500 }
    );
  }
}
