/// <reference lib="dom" />
// GET /api/team-dashboard/structure/[id]
// Returns the structure row for the given member_id, the full reporting
// chain to the root (managers[]), and direct reports (reports[]).

import { supabase, ok, fail } from '@/lib/team/dashboard-helpers';

interface StructureRow {
  id: string;
  member_id: string;
  reports_to_id: string | null;
  position_level: number;
  member?: any;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const memberId = params.id;

    const { data: self, error: selfErr } = await supabase
      .from('team_structure')
      .select('id, member_id, reports_to_id, position_level, member:team_members!member_id(*)')
      .eq('member_id', memberId)
      .single();

    if (selfErr || !self) return fail('NOT_FOUND', 'Structure entry not found', 404);

    // Walk up the chain by repeatedly fetching reports_to_id. Cap at 20 hops to
    // defend against cyclic data.
    const managers: StructureRow[] = [];
    let cursor: string | null = (self as any).reports_to_id;
    const seen = new Set<string>([memberId]);
    let hops = 0;
    while (cursor && !seen.has(cursor) && hops < 20) {
      seen.add(cursor);
      hops += 1;
      const { data: parent, error: parentErr } = await supabase
        .from('team_structure')
        .select('id, member_id, reports_to_id, position_level, member:team_members!member_id(*)')
        .eq('member_id', cursor)
        .single();
      if (parentErr || !parent) break;
      managers.push(parent as unknown as StructureRow);
      cursor = (parent as any).reports_to_id;
    }

    const { data: reports, error: reportsErr } = await supabase
      .from('team_structure')
      .select('id, member_id, reports_to_id, position_level, member:team_members!member_id(*)')
      .eq('reports_to_id', memberId)
      .order('position_level', { ascending: true });

    if (reportsErr) return fail('INTERNAL_ERROR', reportsErr.message, 500);

    return ok({
      self,
      managers,
      reports: reports || [],
    });
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}
