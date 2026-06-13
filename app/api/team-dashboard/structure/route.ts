/// <reference lib="dom" />
// GET /api/team-dashboard/structure
// Returns the full reporting hierarchy as both a flat list and a nested tree.
// Each node carries the linked team_member record under `.member`.

import { supabase, ok, fail } from '@/lib/team/dashboard-helpers';
import { buildTree, StructureRow } from '@/lib/team/structure-tree';

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from('team_structure')
      .select('id, member_id, reports_to_id, position_level, member:team_members!member_id(*)')
      .order('position_level', { ascending: true });

    if (error) return fail('INTERNAL_ERROR', error.message, 500);

    const flat = (rows || []) as unknown as StructureRow[];
    const tree = buildTree(flat);

    return ok({ tree, flat, count: flat.length });
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}
