/// <reference lib="dom" />
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const CreateMessageSchema = z.object({
  member_id: z.string().uuid(),
  channel: z.enum(['slack', 'discord', 'telegram']),
  message_content: z.string().min(1),
  message_timestamp: z.string().optional(),
  thread_id: z.string().optional(),
  external_message_id: z.string().optional(),
});

// POST /api/team/communications/messages - Create a team message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreateMessageSchema.parse(body);

    const { data, error } = await supabase
      .from('team_messages')
      .insert([{
        ...validated,
        message_timestamp: validated.message_timestamp || new Date().toISOString(),
      }])
      .select();

    if (error) {
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse(data?.[0], 201);
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

// GET /api/team/communications/messages - List team messages
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channels = searchParams.get('channels')?.split(',') || [];
    const days = parseInt(searchParams.get('days') || '7');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('team_messages')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    if (channels.length > 0) {
      query = query.in('channel', channels);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
        return jsonResponse({
          data: [],
          count: 0,
          limit,
          offset,
          period: { days, startDate },
          channels,
          notice: 'Table team_messages not yet initialized',
        });
      }
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
      period: { days, startDate },
      channels,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
