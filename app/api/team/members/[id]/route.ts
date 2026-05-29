/// <reference lib="dom" />
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validation schema for updates
const UpdateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  bio: z.string().optional(),
  active: z.boolean().optional(),
});

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getCurrentUserId(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret) as any;
    return decoded.sub || null;
  } catch (error) {
    return null;
  }
}

// GET /api/team/members/[id] - Get a specific team member
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return jsonResponse({ error: 'Member not found' }, 404);
    }

    return jsonResponse({ data });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}

// PUT /api/team/members/[id] - Update a team member
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify member exists
    const { data: existing, error: checkError } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();

    if (checkError || !existing) {
      return jsonResponse({ error: 'Member not found' }, 404);
    }

    const body = await request.json();
    const validated = UpdateMemberSchema.parse(body);

    const updateData = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('team_members')
      .update(updateData)
      .eq('id', params.id)
      .select();

    if (error) {
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({ data: data[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return jsonResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}

// DELETE /api/team/members/[id] - Delete a team member
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify member exists
    const { data: existing, error: checkError } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();

    if (checkError || !existing) {
      return jsonResponse({ error: 'Member not found' }, 404);
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', params.id);

    if (error) {
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({ success: true, message: 'Member deleted' });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
