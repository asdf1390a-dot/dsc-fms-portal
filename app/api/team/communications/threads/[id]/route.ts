/// <reference lib="dom" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// GET /api/team/communications/threads/[id] - Get thread with all messages
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const threadId = params.id;

    // Fetch thread
    const { data: thread, error: threadError } = await supabase
      .from('team_message_threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (threadError) {
      if (threadError.code === 'PGRST116' || threadError.code === 'PGRST205' || threadError.message?.includes('does not exist') || threadError.message?.includes('Could not find the table')) {
        return jsonResponse(
          { error: 'Thread not found', notice: 'Table team_message_threads not yet initialized' },
          404
        );
      }
      return jsonResponse(
        { error: 'Thread not found' },
        404
      );
    }

    // Fetch messages in thread with member details
    const { data: messages, error: messagesError, count } = await supabase
      .from('team_messages')
      .select(`
        *,
        team_members:member_id(id, name, email, avatar_url)
      `)
      .eq('thread_id', threadId)
      .order('message_timestamp', { ascending: true });

    if (messagesError) {
      if (messagesError.code === 'PGRST116' || messagesError.code === 'PGRST205' || messagesError.message?.includes('does not exist') || messagesError.message?.includes('Could not find the table')) {
        return jsonResponse({
          thread,
          messages: [],
          totalMessages: 0,
          notice: 'Table team_messages not yet initialized',
        });
      }
      return jsonResponse(
        { error: messagesError.message, code: messagesError.code },
        400
      );
    }

    return jsonResponse({
      thread,
      messages,
      totalMessages: count,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
