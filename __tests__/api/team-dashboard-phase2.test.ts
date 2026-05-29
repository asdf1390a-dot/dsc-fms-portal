// Team Dashboard Phase 2 — handler-level tests.
// Mocks @supabase/supabase-js and invokes the App Router route handlers.

import { NextRequest } from 'next/server'

// Minimum env so route modules can import without crashing.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

// -------------------- Supabase mock --------------------
type QueryResolver = { data: any; error: any; count?: number | null }
let nextQueryResult: QueryResolver = { data: [], error: null, count: 0 }

function makeChain(resolver: () => QueryResolver) {
  const chain: any = {}
  const passthrough = ['select', 'insert', 'update', 'delete', 'eq', 'or', 'order', 'range', 'upsert']
  for (const m of passthrough) chain[m] = jest.fn(() => chain)
  chain.single = jest.fn(() => Promise.resolve(resolver()))
  chain.limit = jest.fn(() => Promise.resolve(resolver()))
  chain.range = jest.fn(() => Promise.resolve(resolver()))
  // Allow await on the chain itself: any of the terminators above will already
  // return a Promise; for chains that end on .order(...) we make it thenable.
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolver()).then(onFulfilled, onRejected)
  return chain
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => makeChain(() => nextQueryResult)),
  })),
}))

function setResult(r: QueryResolver) {
  nextQueryResult = r
}

// -------------------- JWT helpers --------------------
function makeJwt(payload: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  )
  const body = Buffer.from(
    JSON.stringify({
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    })
  ).toString('base64url')
  return `${header}.${body}.sig`
}

function makeRequest(
  url: string,
  init: { method?: string; body?: any; headers?: Record<string, string> } = {}
): NextRequest {
  const headers = new Headers(init.headers || {})
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const req = new Request(url, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  return req as unknown as NextRequest
}

// -------------------- Tests --------------------
import * as Members from '@/app/api/team/members/route'
import * as MemberById from '@/app/api/team/members/[id]/route'
import * as Structure from '@/app/api/team/structure/route'
import * as Portfolio from '@/app/api/team/portfolio/route'
import * as Activity from '@/app/api/team/activity/route'
import * as PortfolioByMember from '@/app/api/portfolio/[memberId]/route'
import * as ActivityByMember from '@/app/api/activity-log/[memberId]/route'
import { buildTree } from '@/lib/team/structure-tree'
import { authenticateRequest, decodeJWT, isTokenExpired } from '@/lib/team/auth'

describe('lib/team/auth', () => {
  it('decodes a valid JWT', () => {
    const tok = makeJwt({ email: 'a@b.c' })
    const p = decodeJWT(tok)
    expect(p?.email).toBe('a@b.c')
    expect(isTokenExpired(p)).toBe(false)
  })
  it('rejects expired JWTs', () => {
    const tok = makeJwt({ exp: 1 })
    expect(isTokenExpired(decodeJWT(tok))).toBe(true)
  })
  it('returns missing_token when header absent', () => {
    const r = authenticateRequest(makeRequest('http://x/'))
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('missing_token')
  })
  it('accepts a Bearer token', () => {
    const r = authenticateRequest(
      makeRequest('http://x/', { headers: { authorization: `Bearer ${makeJwt()}` } })
    )
    expect(r.ok).toBe(true)
    expect(r.user?.sub).toBe('user-1')
  })
})

describe('GET /api/team/members', () => {
  it('returns paginated rows', async () => {
    setResult({
      data: [{ id: '1', name: 'John', email: 'j@x.io', active: true }],
      error: null,
      count: 1,
    })
    const res = await Members.GET(makeRequest('http://x/api/team/members?page=1&limit=20'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
  })

  it('clamps page/limit to safe defaults', async () => {
    setResult({ data: [], error: null, count: 0 })
    const res = await Members.GET(
      makeRequest('http://x/api/team/members?page=-1&limit=9999')
    )
    const json = await res.json()
    expect(json.pagination.page).toBe(1)
    expect(json.pagination.limit).toBeLessThanOrEqual(100)
  })

  it('returns 500 on supabase error', async () => {
    setResult({ data: null, error: { message: 'boom' }, count: null })
    const res = await Members.GET(makeRequest('http://x/api/team/members'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
  })
})

describe('POST /api/team/members', () => {
  it('rejects without Bearer token', async () => {
    const res = await Members.POST(
      makeRequest('http://x/api/team/members', {
        method: 'POST',
        body: { name: 'A', email: 'a@x.io' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects without required fields', async () => {
    const res = await Members.POST(
      makeRequest('http://x/api/team/members', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { name: 'A' },
      })
    )
    expect(res.status).toBe(400)
  })

  it('creates a member with auth', async () => {
    setResult({ data: { id: 'new-id', name: 'A', email: 'a@x.io' }, error: null })
    const res = await Members.POST(
      makeRequest('http://x/api/team/members', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { name: 'A', email: 'a@x.io', department: '기술' },
      })
    )
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('new-id')
  })
})

describe('PUT/DELETE /api/team/members/:id', () => {
  it('PUT rejects unauthenticated', async () => {
    const res = await MemberById.PUT(
      makeRequest('http://x/api/team/members/1', { method: 'PUT', body: { name: 'B' } }),
      { params: { id: '1' } }
    )
    expect(res.status).toBe(401)
  })

  it('PUT updates a member', async () => {
    setResult({ data: { id: '1', name: 'B' }, error: null })
    const res = await MemberById.PUT(
      makeRequest('http://x/api/team/members/1', {
        method: 'PUT',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { name: 'B' },
      }),
      { params: { id: '1' } }
    )
    expect(res.status).toBe(200)
  })

  it('PUT rejects an empty patch body', async () => {
    const res = await MemberById.PUT(
      makeRequest('http://x/api/team/members/1', {
        method: 'PUT',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: {},
      }),
      { params: { id: '1' } }
    )
    expect(res.status).toBe(400)
  })

  it('DELETE rejects unauthenticated', async () => {
    const res = await MemberById.DELETE(
      makeRequest('http://x/api/team/members/1', { method: 'DELETE' }),
      { params: { id: '1' } }
    )
    expect(res.status).toBe(401)
  })

  it('DELETE removes a member when authed', async () => {
    setResult({ data: null, error: null })
    const res = await MemberById.DELETE(
      makeRequest('http://x/api/team/members/1', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${makeJwt()}` },
      }),
      { params: { id: '1' } }
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.id).toBe('1')
  })
})

describe('buildTree (structure)', () => {
  it('nests children under parents and surfaces orphans as roots', () => {
    const rows = [
      { id: 'sa', member_id: 'a', reports_to_id: null, position_level: 0, member: { name: 'A' } },
      { id: 'sb', member_id: 'b', reports_to_id: 'a', position_level: 1, member: { name: 'B' } },
      { id: 'sc', member_id: 'c', reports_to_id: 'a', position_level: 1, member: { name: 'C' } },
      { id: 'sd', member_id: 'd', reports_to_id: 'b', position_level: 2, member: { name: 'D' } },
      { id: 'se', member_id: 'e', reports_to_id: 'ghost', position_level: 9, member: { name: 'E' } },
    ]
    const tree = buildTree(rows as any)
    // 2 roots: 'a' and orphan 'e'
    expect(tree.map((t) => t.member_id).sort()).toEqual(['a', 'e'])
    const a = tree.find((t) => t.member_id === 'a')!
    expect(a.children.map((c) => c.member_id).sort()).toEqual(['b', 'c'])
    const b = a.children.find((c) => c.member_id === 'b')!
    expect(b.children).toHaveLength(1)
    expect(b.children[0].member_id).toBe('d')
  })
})

describe('GET /api/team/structure', () => {
  it('returns a tree wrapper', async () => {
    setResult({
      data: [
        { id: 's1', member_id: 'a', reports_to_id: null, position_level: 0, member: { name: 'A' } },
        { id: 's2', member_id: 'b', reports_to_id: 'a', position_level: 1, member: { name: 'B' } },
      ],
      error: null,
    })
    const res = await Structure.GET(makeRequest('http://x/api/team/structure'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(json.data.tree)).toBe(true)
    expect(json.data.tree[0].children).toHaveLength(1)
  })
})

describe('POST /api/team/structure', () => {
  it('rejects unauthenticated', async () => {
    const res = await Structure.POST(
      makeRequest('http://x/api/team/structure', {
        method: 'POST',
        body: { member_id: 'a' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('upserts a structure row', async () => {
    setResult({ data: { id: 's1', member_id: 'a', position_level: 1 }, error: null })
    const res = await Structure.POST(
      makeRequest('http://x/api/team/structure', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { member_id: 'a', position_level: 1 },
      })
    )
    expect(res.status).toBe(201)
  })
})

describe('Portfolio routes', () => {
  it('GET /api/team/portfolio returns rows', async () => {
    setResult({
      data: [{ id: 'p1', member_id: 'a', project_name: 'P' }],
      error: null,
    })
    const res = await Portfolio.GET(makeRequest('http://x/api/team/portfolio'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('GET /api/portfolio/:memberId scopes by memberId', async () => {
    setResult({
      data: [{ id: 'p1', member_id: 'a', project_name: 'P' }],
      error: null,
    })
    const res = await PortfolioByMember.GET(
      makeRequest('http://x/api/portfolio/a'),
      { params: { memberId: 'a' } }
    )
    expect(res.status).toBe(200)
  })

  it('POST /api/portfolio/:memberId requires auth and project_name', async () => {
    const res1 = await PortfolioByMember.POST(
      makeRequest('http://x/api/portfolio/a', { method: 'POST', body: {} }),
      { params: { memberId: 'a' } }
    )
    expect(res1.status).toBe(401)

    const res2 = await PortfolioByMember.POST(
      makeRequest('http://x/api/portfolio/a', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: {},
      }),
      { params: { memberId: 'a' } }
    )
    expect(res2.status).toBe(400)
  })

  it('POST /api/portfolio/:memberId creates an item', async () => {
    setResult({
      data: { id: 'p1', member_id: 'a', project_name: 'Hello' },
      error: null,
    })
    const res = await PortfolioByMember.POST(
      makeRequest('http://x/api/portfolio/a', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { project_name: 'Hello' },
      }),
      { params: { memberId: 'a' } }
    )
    expect(res.status).toBe(201)
  })
})

describe('Activity log routes', () => {
  it('GET /api/team/activity returns rows', async () => {
    setResult({ data: [{ id: 'a1', member_id: 'a', activity_type: 'login' }], error: null })
    const res = await Activity.GET(makeRequest('http://x/api/team/activity?limit=5'))
    expect(res.status).toBe(200)
  })

  it('GET /api/activity-log/:memberId scopes by memberId', async () => {
    setResult({ data: [{ id: 'a1', member_id: 'a', activity_type: 'login' }], error: null })
    const res = await ActivityByMember.GET(
      makeRequest('http://x/api/activity-log/a?limit=10'),
      { params: { memberId: 'a' } }
    )
    expect(res.status).toBe(200)
  })

  it('POST /api/team/activity requires member_id and activity_type', async () => {
    const res = await Activity.POST(
      makeRequest('http://x/api/team/activity', {
        method: 'POST',
        headers: { authorization: `Bearer ${makeJwt()}` },
        body: { member_id: 'a' },
      })
    )
    expect(res.status).toBe(400)
  })
})
