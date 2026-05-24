// app/api/travels/[id]/notifications/route.ts
// Manages travel_notification_rules — preset + custom rules per travel.
// GET    — list rules (read access)
// POST   — create rule { rule_type, rule_config?, is_enabled? } (write access)
// PATCH  — toggle/update rule { ruleId, is_enabled?, rule_config? } (write access)
// DELETE — delete rule { ruleId } (write access)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import { hasReadAccess, hasWriteAccess } from '@/lib/travel/service';
import type {
  TravelNotificationRule,
  ApiResponse,
  ApiResponseList,
} from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T> | ApiResponseList<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId)
      return json<TravelNotificationRule[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead)
      return json<TravelNotificationRule[]>({ error: 'Forbidden', status: 403 }, 403);

    const { data, error } = await supabaseAdmin
      .from('travel_notification_rules')
      .select('*')
      .eq('travel_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch notification rules error:', error);
      return json<TravelNotificationRule[]>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelNotificationRule[]>(
      { data: (data || []) as TravelNotificationRule[], status: 200 },
      200
    );
  } catch (err) {
    console.error('GET /notifications error:', err);
    return json<TravelNotificationRule[]>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId)
      return json<TravelNotificationRule>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite)
      return json<TravelNotificationRule>({ error: 'Forbidden', status: 403 }, 403);

    const payload: {
      rule_type?: string;
      rule_config?: Record<string, any>;
      is_enabled?: boolean;
    } = await request.json();

    if (!payload.rule_type) {
      return json<TravelNotificationRule>(
        { error: 'rule_type is required', status: 400 },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from('travel_notification_rules')
      .insert([
        {
          travel_id: params.id,
          rule_type: payload.rule_type,
          rule_config: payload.rule_config || {},
          is_enabled: payload.is_enabled ?? true,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error('Insert notification rule error:', error);
      return json<TravelNotificationRule>(
        { error: error?.message || 'Failed to create rule', status: 500 },
        500
      );
    }

    return json<TravelNotificationRule>(
      { data: data as TravelNotificationRule, status: 201 },
      201
    );
  } catch (err) {
    console.error('POST /notifications error:', err);
    return json<TravelNotificationRule>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId)
      return json<TravelNotificationRule>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite)
      return json<TravelNotificationRule>({ error: 'Forbidden', status: 403 }, 403);

    const body: {
      ruleId?: string;
      is_enabled?: boolean;
      rule_config?: Record<string, any>;
    } = await request.json();

    if (!body.ruleId) {
      return json<TravelNotificationRule>(
        { error: 'ruleId is required', status: 400 },
        400
      );
    }

    const patch: Record<string, any> = {};
    if (typeof body.is_enabled === 'boolean') patch.is_enabled = body.is_enabled;
    if (body.rule_config) patch.rule_config = body.rule_config;

    if (Object.keys(patch).length === 0) {
      return json<TravelNotificationRule>(
        { error: 'No valid fields to update', status: 400 },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from('travel_notification_rules')
      .update(patch)
      .eq('id', body.ruleId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Update notification rule error:', error);
      return json<TravelNotificationRule>(
        { error: error?.message || 'Failed to update rule', status: 500 },
        500
      );
    }

    return json<TravelNotificationRule>(
      { data: data as TravelNotificationRule, status: 200 },
      200
    );
  } catch (err) {
    console.error('PATCH /notifications error:', err);
    return json<TravelNotificationRule>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId)
      return json<TravelNotificationRule>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite)
      return json<TravelNotificationRule>({ error: 'Forbidden', status: 403 }, 403);

    const body: { ruleId?: string } = await request.json();
    if (!body.ruleId) {
      return json<TravelNotificationRule>(
        { error: 'ruleId is required', status: 400 },
        400
      );
    }

    const { error } = await supabaseAdmin
      .from('travel_notification_rules')
      .delete()
      .eq('id', body.ruleId)
      .eq('travel_id', params.id);

    if (error) {
      console.error('Delete notification rule error:', error);
      return json<TravelNotificationRule>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelNotificationRule>(
      { message: 'Notification rule deleted', status: 200 },
      200
    );
  } catch (err) {
    console.error('DELETE /notifications error:', err);
    return json<TravelNotificationRule>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
