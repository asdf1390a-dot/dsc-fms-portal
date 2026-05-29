// Helper for app/api/team/structure/route.ts — kept in a sibling file because
// Next.js App Router route files can only export HTTP handler symbols.
export interface StructureRow {
  id: string
  member_id: string
  reports_to_id: string | null
  position_level: number
  member?: any
}

export interface StructureNode extends StructureRow {
  children: StructureNode[]
}

export function buildTree(rows: StructureRow[]): StructureNode[] {
  const byMember = new Map<string, StructureNode>()
  for (const r of rows) {
    byMember.set(r.member_id, { ...r, children: [] })
  }
  const roots: StructureNode[] = []
  for (const node of Array.from(byMember.values())) {
    if (node.reports_to_id && byMember.has(node.reports_to_id)) {
      byMember.get(node.reports_to_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (nodes: StructureNode[]) => {
    nodes.sort(
      (a, b) =>
        a.position_level - b.position_level ||
        (a.member?.name || '').localeCompare(b.member?.name || '')
    )
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}
