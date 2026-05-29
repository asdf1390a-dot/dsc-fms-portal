/// <reference lib="dom" />
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { CreateTeamMemberRequest, UpdateTeamMemberRequest } from '@/lib/types/team-dashboard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Validation schemas
const CreateMemberSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Invalid email'),
  role: z.string().min(1, 'role is required'),
  department: z.string().optional(),
  phone: z.string().optional(),
  start_date: z.string().date().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  bio: z.string().optional(),
});

const UpdateMemberSchema = CreateMemberSchema.partial();

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

// GET /api/team/members - List all team members with filtering and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const role = searchParams.get('role');
    const active = searchParams.get('active');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('team_members')
      .select('*', { count: 'exact' });

    if (department) {
      query = query.eq('department', department);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (active !== null) {
      query = query.eq('active', active === 'true');
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({
      data,
      count,
      limit,
      offset,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}

// POST /api/team/members - Create a new team member
export async function POST(request: Request) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json();
    const validated = CreateMemberSchema.parse(body);

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', validated.email)
      .single();

    if (!checkError && existing) {
      return jsonResponse({ error: 'Email already exists' }, 409);
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert([{
        ...validated,
        active: true,
      }])
      .select();

    if (error) {
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({ data: data[0] }, 201);
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
