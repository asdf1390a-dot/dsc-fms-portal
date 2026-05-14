// lib/travel/settlement.ts
// Settlement calculation service for travel cost splitting and balance computation

import { SupabaseClient } from '@supabase/supabase-js';

export interface SettlementMember {
  member_id: string;
  user_id: string;
  total_paid: number;
  share: number;
  balance: number; // total_paid - share (positive = owed money, negative = owes money)
}

export interface SettlementSummary {
  settlement: SettlementMember[];
  total_cost: number;
  currency: string;
  by_date: { [key: string]: number }; // date => total cost
}

interface CostData {
  id: string;
  payer_id: string;
  amount: number;
  currency: string;
  cost_date: string;
  splits: Array<{
    member_id: string;
    amount: number;
  }>;
}

interface MemberData {
  id: string;
  user_id: string;
}

/**
 * Calculate settlement summary for a travel
 * @param supabase Supabase client
 * @param travelId Travel ID
 * @returns Settlement summary with member balances and daily breakdown
 */
export async function calculateSettlement(
  supabase: SupabaseClient,
  travelId: string
): Promise<SettlementSummary> {
  // Fetch all costs with splits
  const { data: costs } = await supabase
    .from('travel_costs')
    .select(
      `
    id,
    payer_id,
    amount,
    currency,
    cost_date,
    splits:travel_cost_splits(
      member_id,
      amount
    )
  `
    )
    .eq('travel_id', travelId);

  // Fetch all members
  const { data: members } = await supabase
    .from('travel_members')
    .select('id, user_id')
    .eq('travel_id', travelId);

  return computeSettlement(costs || [], members || []);
}

/**
 * Compute settlement from cost and member data
 * Pure computation function, no DB access
 */
export function computeSettlement(
  costs: CostData[],
  members: MemberData[]
): SettlementSummary {
  const settlement: SettlementMember[] = [];
  const byDate: { [key: string]: number } = {};

  // Initialize by_date tracking
  costs.forEach((cost) => {
    byDate[cost.cost_date] = (byDate[cost.cost_date] || 0) + cost.amount;
  });

  // Calculate per-member settlement
  members.forEach((member) => {
    let totalPaid = 0;
    let share = 0;

    costs.forEach((cost) => {
      // Count how much this member paid
      if (cost.payer_id === member.user_id) {
        totalPaid += cost.amount;
      }

      // Count how much this member's share is
      const split = cost.splits?.find((s) => s.member_id === member.id);
      if (split) {
        share += split.amount;
      }
    });

    settlement.push({
      member_id: member.id,
      user_id: member.user_id,
      total_paid: Math.round(totalPaid * 100) / 100,
      share: Math.round(share * 100) / 100,
      balance: Math.round((totalPaid - share) * 100) / 100,
    });
  });

  const totalCost = Math.round(
    costs.reduce((sum, c) => sum + c.amount, 0) * 100
  ) / 100;

  return {
    settlement,
    total_cost: totalCost,
    currency: costs[0]?.currency || 'INR',
    by_date: byDate,
  };
}

/**
 * Get settlement between two members
 * Returns who owes whom and how much
 */
export function getBilateralSettlement(
  settlement: SettlementMember[],
  member1Id: string,
  member2Id: string
): { from: string; to: string; amount: number } | null {
  const m1 = settlement.find((m) => m.member_id === member1Id);
  const m2 = settlement.find((m) => m.member_id === member2Id);

  if (!m1 || !m2) return null;

  // If m1 has positive balance (owed money), m2 owes m1
  // If m2 has positive balance, m1 owes m2
  if (m1.balance > 0.01) {
    return { from: member2Id, to: member1Id, amount: m1.balance };
  } else if (m2.balance > 0.01) {
    return { from: member1Id, to: member2Id, amount: m2.balance };
  }

  return null;
}

/**
 * Simplify settlement (minimize number of transactions)
 * Groups members by net balance and suggests optimal payment paths
 */
export function simplifySettlement(
  settlement: SettlementMember[]
): Array<{ from: string; to: string; amount: number }> {
  const debtors = settlement.filter((m) => m.balance < -0.01);
  const creditors = settlement.filter((m) => m.balance > 0.01);

  const transactions: Array<{ from: string; to: string; amount: number }> = [];

  debtors.forEach((debtor) => {
    let owed = Math.abs(debtor.balance);

    for (let creditor of creditors) {
      if (creditor.balance < 0.01) continue; // Fully settled
      if (owed < 0.01) break; // Debtor fully settled

      const payment = Math.min(owed, creditor.balance);
      transactions.push({
        from: debtor.user_id,
        to: creditor.user_id,
        amount: Math.round(payment * 100) / 100,
      });

      owed -= payment;
      creditor.balance -= payment;
    }
  });

  return transactions;
}

/**
 * Validate that all costs have valid splits
 * (e.g., split amounts sum to cost amount, all members are valid)
 */
export async function validateCosts(
  supabase: SupabaseClient,
  travelId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  const { data: costs } = await supabase
    .from('travel_costs')
    .select(
      `
    id,
    amount,
    splits:travel_cost_splits(
      member_id,
      amount
    )
  `
    )
    .eq('travel_id', travelId);

  const { data: members } = await supabase
    .from('travel_members')
    .select('id')
    .eq('travel_id', travelId);

  const validMemberIds = new Set(members?.map((m) => m.id) || []);

  costs?.forEach((cost) => {
    // Validate split members exist
    cost.splits?.forEach((split: any) => {
      if (!validMemberIds.has(split.member_id)) {
        errors.push(
          `Cost ${cost.id}: split member ${split.member_id} not found`
        );
      }
    });

    // Check if splits sum to cost amount (with 0.01 tolerance for floating point)
    const splitSum = (cost.splits || []).reduce(
      (sum: number, s: any) => sum + s.amount,
      0
    );
    if (Math.abs(splitSum - cost.amount) > 0.01) {
      errors.push(
        `Cost ${cost.id}: splits (${splitSum}) do not match amount (${cost.amount})`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
