// lib/travel/service.ts
// Shared utilities for travel module: permission checks, data fetching, validation

import { SupabaseClient } from '@supabase/supabase-js';
import { Travel, TravelMember } from './types';

/**
 * Check if user is the organizer (travel creator) of a travel
 */
export async function isOrganizer(
  supabase: SupabaseClient,
  userId: string,
  travelId: string
): Promise<boolean> {
  const { data: travel } = await supabase
    .from('travels')
    .select('user_id')
    .eq('id', travelId)
    .single();

  return travel?.user_id === userId;
}

/**
 * Check if user is a member of a travel
 * Returns member data if exists, null otherwise
 */
export async function getMemberInTravel(
  supabase: SupabaseClient,
  userId: string,
  travelId: string
): Promise<TravelMember | null> {
  const { data: member } = await supabase
    .from('travel_members')
    .select('*')
    .eq('travel_id', travelId)
    .eq('user_id', userId)
    .single();

  return member || null;
}

/**
 * Check if user has read access to a travel
 * (organizer or travel member)
 */
export async function hasReadAccess(
  supabase: SupabaseClient,
  userId: string,
  travelId: string
): Promise<boolean> {
  const isOrg = await isOrganizer(supabase, userId, travelId);
  if (isOrg) return true;

  const member = await getMemberInTravel(supabase, userId, travelId);
  return !!member;
}

/**
 * Check if user has write access to a travel
 * (organizer or member with read_write permission)
 */
export async function hasWriteAccess(
  supabase: SupabaseClient,
  userId: string,
  travelId: string
): Promise<boolean> {
  const isOrg = await isOrganizer(supabase, userId, travelId);
  if (isOrg) return true;

  const member = await getMemberInTravel(supabase, userId, travelId);
  return member?.permission === 'read_write';
}

/**
 * Fetch travel with all relations
 */
export async function getTravelWithRelations(
  supabase: SupabaseClient,
  travelId: string
) {
  const { data: travel, error } = await supabase
    .from('travels')
    .select(
      `
    *,
    members:travel_members(*),
    events:travel_events(*),
    costs:travel_costs(
      *,
      splits:travel_cost_splits(*)
    ),
    checklist:travel_checklist_items(*),
    documents:travel_documents(*),
    notification_rules:travel_notification_rules(*)
  `
    )
    .eq('id', travelId)
    .single();

  if (error) throw error;
  return travel;
}

/**
 * Fetch all travels for a user (as organizer)
 */
export async function getUserTravels(
  supabase: SupabaseClient,
  userId: string,
  status?: 'upcoming' | 'ongoing' | 'completed',
  sortBy: 'date' | 'cost' | 'name' = 'date'
) {
  let query = supabase
    .from('travels')
    .select('*')
    .eq('user_id', userId);

  if (status) {
    query = query.eq('status', status);
  }

  if (sortBy === 'date') {
    query = query.order('start_date', { ascending: false });
  } else if (sortBy === 'cost') {
    query = query.order('created_at', { ascending: false }); // TODO: add cost calculation
  } else {
    query = query.order('name', { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Fetch all travels user is involved in
 * (as organizer or member)
 */
export async function getUserInvolvedTravels(
  supabase: SupabaseClient,
  userId: string
) {
  // Get travels as organizer
  const organizedTravels = await getUserTravels(supabase, userId);

  // Get travels as member
  const { data: memberTravels, error } = await supabase
    .from('travel_members')
    .select(
      `
    travel_id,
    travels(*)
  `
    ) as { data: Array<{ travel_id: string; travels: Travel }> | null; error: any };

  if (error) throw error;

  // Combine and deduplicate
  const travelMap = new Map();
  organizedTravels.forEach((t) => travelMap.set(t.id, t));
  memberTravels?.forEach((m) => travelMap.set(m.travels.id, m.travels));

  return Array.from(travelMap.values());
}

/**
 * Fetch all members of a travel with user metadata
 */
export async function getTravelMembers(
  supabase: SupabaseClient,
  travelId: string
) {
  const { data: members, error } = await supabase
    .from('travel_members')
    .select(
      `
    *,
    user:auth.users(id, email, user_metadata)
  `
    )
    .eq('travel_id', travelId);

  if (error) throw error;
  return members;
}

/**
 * Fetch all costs of a travel
 */
export async function getTravelCosts(
  supabase: SupabaseClient,
  travelId: string
) {
  const { data: costs, error } = await supabase
    .from('travel_costs')
    .select(
      `
    *,
    splits:travel_cost_splits(*)
  `
    )
    .eq('travel_id', travelId)
    .order('cost_date', { ascending: false });

  if (error) throw error;
  return costs;
}

/**
 * Fetch all events of a travel
 */
export async function getTravelEvents(
  supabase: SupabaseClient,
  travelId: string
) {
  const { data: events, error } = await supabase
    .from('travel_events')
    .select('*')
    .eq('travel_id', travelId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) throw error;
  return events;
}

/**
 * Validate travel dates (end_date >= start_date)
 */
export function validateTravelDates(
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return {
      valid: false,
      error: 'End date must be greater than or equal to start date',
    };
  }

  return { valid: true };
}

/**
 * Validate cost amount (must be positive)
 */
export function validateCostAmount(amount: number): {
  valid: boolean;
  error?: string;
} {
  if (isNaN(amount) || amount < 0) {
    return {
      valid: false,
      error: 'Cost amount must be a non-negative number',
    };
  }

  return { valid: true };
}

/**
 * Validate split amounts sum to cost amount
 */
export function validateCostSplits(
  costAmount: number,
  splits: Array<{ member_id: string; amount: number }>
): { valid: boolean; error?: string } {
  if (!splits || splits.length === 0) {
    return { valid: true }; // No splits is valid (equal split across all members)
  }

  const splitSum = splits.reduce((sum, split) => sum + split.amount, 0);
  const tolerance = 0.01; // Allow for floating point errors

  if (Math.abs(splitSum - costAmount) > tolerance) {
    return {
      valid: false,
      error: `Split amounts (${splitSum}) must sum to cost amount (${costAmount})`,
    };
  }

  return { valid: true };
}

/**
 * Validate file upload (size and type)
 */
export function validateFileUpload(
  file: File,
  maxSizeMB: number = 50,
  allowedTypes: string[] = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Check if user can modify a specific travel member
 * (only organizer or the member themselves)
 */
export async function canModifyMember(
  supabase: SupabaseClient,
  userId: string,
  travelId: string,
  targetMemberId: string
): Promise<boolean> {
  // User must be organizer
  const isOrg = await isOrganizer(supabase, userId, travelId);
  if (!isOrg) return false;

  // Target member must exist in travel
  const { data: member } = await supabase
    .from('travel_members')
    .select('id')
    .eq('id', targetMemberId)
    .eq('travel_id', travelId)
    .single();

  return !!member;
}

/**
 * Get user's total spending across all travels
 */
export async function getUserTravelExpense(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: travels } = await supabase
    .from('travels')
    .select('id')
    .eq('user_id', userId);

  if (!travels || travels.length === 0) return 0;

  let totalExpense = 0;

  for (const travel of travels) {
    const { data: costs } = await supabase
      .from('travel_costs')
      .select('amount')
      .eq('travel_id', travel.id)
      .eq('payer_id', userId);

    totalExpense += (costs || []).reduce((sum, c) => sum + c.amount, 0);
  }

  return totalExpense;
}
