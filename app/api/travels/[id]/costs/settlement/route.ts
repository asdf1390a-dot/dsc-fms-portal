// app/api/travels/[id]/costs/settlement/route.ts
// GET — compute settlement summary for all members of a travel
// balance = total_paid - share. Negative = owes; Positive = is owed.

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import { hasReadAccess } from '@/lib/travel/service';
import type {
  SettlementSummary,
  SettlementRecord,
  ApiResponse,
} from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<SettlementSummary>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<SettlementSummary>({ error: 'Forbidden', status: 403 }, 403);

    const { data: members, error: memberErr } = await supabaseAdmin
      .from('travel_members')
      .select('id, user_id')
      .eq('travel_id', params.id);

    if (memberErr) {
      console.error('Fetch members error:', memberErr);
      return json<SettlementSummary>({ error: memberErr.message, status: 500 }, 500);
    }

    const { data: costs, error: costErr } = await supabaseAdmin
      .from('travel_costs')
      .select('id, payer_id, amount, currency, splits:travel_cost_splits(member_id, amount)')
      .eq('travel_id', params.id);

    if (costErr) {
      console.error('Fetch costs error:', costErr);
      return json<SettlementSummary>({ error: costErr.message, status: 500 }, 500);
    }

    const memberList = members || [];
    const memberIds = memberList.map((m) => m.id);
    const totalCost = (costs || []).reduce((sum, c: any) => sum + Number(c.amount || 0), 0);
    const currency = (costs && costs.length > 0 ? (costs[0] as any).currency : 'INR') || 'INR';

    const paidByMember: Record<string, number> = {};
    const shareByMember: Record<string, number> = {};
    memberIds.forEach((id) => {
      paidByMember[id] = 0;
      shareByMember[id] = 0;
    });

    (costs || []).forEach((c: any) => {
      const amount = Number(c.amount || 0);
      if (c.payer_id && paidByMember[c.payer_id] !== undefined) {
        paidByMember[c.payer_id] += amount;
      }

      if (c.splits && c.splits.length > 0) {
        c.splits.forEach((s: any) => {
          if (shareByMember[s.member_id] !== undefined) {
            shareByMember[s.member_id] += Number(s.amount || 0);
          }
        });
      } else {
        // No explicit splits: equal share across members for this cost
        const perMember = memberIds.length > 0 ? amount / memberIds.length : 0;
        memberIds.forEach((id) => {
          shareByMember[id] += perMember;
        });
      }
    });

    const settlement: SettlementRecord[] = memberList.map((m) => {
      const total_paid = Math.round((paidByMember[m.id] || 0) * 100) / 100;
      const share = Math.round((shareByMember[m.id] || 0) * 100) / 100;
      return {
        member_id: m.id,
        total_paid,
        share,
        balance: Math.round((total_paid - share) * 100) / 100,
      };
    });

    return json<SettlementSummary>(
      {
        data: {
          settlement,
          total_cost: Math.round(totalCost * 100) / 100,
          currency,
        },
        status: 200,
      },
      200
    );
  } catch (err) {
    console.error('GET /costs/settlement error:', err);
    return json<SettlementSummary>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
