// __tests__/api/assets-scans-get.test.js
// Handler-level tests for GET /api/assets/[assetId]/scans.
//
// Mirrors the mock style of assets-scans.test.js (POST).

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

const VALID_ASSET_ID = '11111111-1111-1111-1111-111111111111';
const INVALID_ASSET_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-abc';
const USER_ID_2 = 'user-def';

// In-memory fixture: scan rows for VALID_ASSET_ID.
function buildFixture() {
  return [
    {
      id: 'scan-1',
      asset_id: VALID_ASSET_ID,
      qr_payload: 'p1',
      scanned_at: '2026-05-30T10:00:00Z',
      scanned_by: USER_ID,
      device_info: 'UA-1',
      location_gps: '12.97,77.59',
    },
    {
      id: 'scan-2',
      asset_id: VALID_ASSET_ID,
      qr_payload: 'p2',
      scanned_at: '2026-05-31T10:00:00Z',
      scanned_by: USER_ID,
      device_info: 'UA-2',
      location_gps: null,
    },
    {
      id: 'scan-3',
      asset_id: VALID_ASSET_ID,
      qr_payload: 'p3',
      scanned_at: '2026-06-01T10:00:00Z',
      scanned_by: USER_ID_2,
      device_info: 'UA-3',
      location_gps: null,
    },
  ];
}

let scansFixture = buildFixture();
let nextRequireUser = { user: { id: USER_ID }, error: null };

jest.mock('../../lib/career-auth', () => ({
  requireUser: jest.fn(async () => nextRequireUser),
}));

// Mock supabase-admin with a fluent builder that captures filters and resolves
// when awaited (via .then) for count queries, or when .range() is awaited for
// the page query.
jest.mock('../../lib/supabase-admin', () => {
  const EMAIL_BY_ID = {
    'user-abc': 'abc@example.com',
    'user-def': 'def@example.com',
  };

  const fromImpl = (table) => {
    const state = {
      table,
      filters: { eq: {}, gte: null, lte: null },
      headCount: false,
      orderCol: null,
      orderAsc: true,
    };

    function filterRows() {
      let rows = (require('./__scans_fixture__').rows() || []).filter(
        (r) => r.asset_id === state.filters.eq.asset_id || !state.filters.eq.asset_id
      );
      if (state.filters.eq.scanned_by) {
        rows = rows.filter((r) => r.scanned_by === state.filters.eq.scanned_by);
      }
      if (state.filters.gte) {
        rows = rows.filter((r) => r.scanned_at >= state.filters.gte);
      }
      if (state.filters.lte) {
        rows = rows.filter((r) => r.scanned_at <= state.filters.lte);
      }
      if (state.orderCol === 'scanned_at') {
        rows = [...rows].sort((a, b) =>
          state.orderAsc
            ? a.scanned_at.localeCompare(b.scanned_at)
            : b.scanned_at.localeCompare(a.scanned_at)
        );
      }
      return rows;
    }

    const chain = {
      select: jest.fn((_cols, opts) => {
        if (opts && opts.head) state.headCount = true;
        return chain;
      }),
      eq: jest.fn((col, val) => {
        state.filters.eq[col] = val;
        return chain;
      }),
      gte: jest.fn((_col, val) => {
        state.filters.gte = val;
        return chain;
      }),
      lte: jest.fn((_col, val) => {
        state.filters.lte = val;
        return chain;
      }),
      order: jest.fn((col, { ascending } = {}) => {
        state.orderCol = col;
        state.orderAsc = !!ascending;
        return chain;
      }),
      range: jest.fn(async (from, to) => {
        const rows = filterRows();
        return { data: rows.slice(from, to + 1), error: null };
      }),
      maybeSingle: jest.fn(async () => {
        if (state.table === 'assets') {
          if (state.filters.eq.id === VALID_ASSET_ID) {
            return { data: { id: VALID_ASSET_ID }, error: null };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }),
      // Make the chain itself thenable so that `await countQuery` works for
      // head-count queries (no .range()/.maybeSingle()/.single() called).
      then: (resolve, reject) => {
        try {
          if (state.headCount) {
            const rows = filterRows();
            return resolve({ data: null, error: null, count: rows.length });
          }
          // Fallback: resolve as a non-paginated select.
          const rows = filterRows();
          return resolve({ data: rows, error: null, count: rows.length });
        } catch (e) {
          return reject(e);
        }
      },
    };
    return chain;
  };

  return {
    supabaseAdmin: {
      from: jest.fn(fromImpl),
      auth: {
        admin: {
          getUserById: jest.fn(async (uid) => {
            const email = EMAIL_BY_ID[uid];
            if (!email) return { data: { user: null }, error: null };
            return { data: { user: { id: uid, email } }, error: null };
          }),
        },
      },
    },
  };
});

// Tiny shared module the mock reads from so tests can mutate the fixture.
jest.mock(
  './__scans_fixture__',
  () => ({
    rows: () => global.__SCANS_FIXTURE__ || [],
  }),
  { virtual: true }
);

const handler = require('../../pages/api/assets/[assetId]/scans').default;

function makeReq({ method = 'GET', assetId = VALID_ASSET_ID, query = {}, headers = {} } = {}) {
  return {
    method,
    query: { assetId, ...query },
    body: {},
    headers: {
      authorization: 'Bearer fake.jwt.token',
      'user-agent': 'JestTestRunner/1.0',
      ...headers,
    },
  };
}

function makeRes() {
  const res = {};
  res.statusCode = 0;
  res._json = null;
  res._headers = {};
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res._json = body; return res; });
  res.setHeader = jest.fn((k, v) => { res._headers[k] = v; return res; });
  return res;
}

beforeEach(() => {
  scansFixture = buildFixture();
  global.__SCANS_FIXTURE__ = scansFixture;
  nextRequireUser = { user: { id: USER_ID }, error: null };
});

describe('GET /api/assets/[assetId]/scans', () => {
  test('1. valid asset, no filters → 200 with data/total/hasMore', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.data)).toBe(true);
    expect(res._json.total).toBe(3);
    expect(res._json.data.length).toBe(3);
    expect(res._json.hasMore).toBe(false);
  });

  test('2. default ordering is scanned_at DESC', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const ts = res._json.data.map((r) => r.scanned_at);
    expect(ts).toEqual([...ts].sort().reverse());
  });

  test('3. pagination — limit=2, offset=0 → 2 rows, hasMore=true', async () => {
    const req = makeReq({ query: { limit: '2', offset: '0' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.data.length).toBe(2);
    expect(res._json.total).toBe(3);
    expect(res._json.hasMore).toBe(true);
    expect(res._json.limit).toBe(2);
    expect(res._json.offset).toBe(0);
  });

  test('4. pagination — limit=2, offset=2 → 1 row, hasMore=false', async () => {
    const req = makeReq({ query: { limit: '2', offset: '2' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.data.length).toBe(1);
    expect(res._json.hasMore).toBe(false);
  });

  test('5. filter by scanned_by → only that user rows', async () => {
    const req = makeReq({ query: { scanned_by: USER_ID_2 } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.total).toBe(1);
    expect(res._json.data[0].scanned_by).toBe(USER_ID_2);
  });

  test('6. filter by from_date / to_date → date range applied', async () => {
    const req = makeReq({ query: { from_date: '2026-05-31', to_date: '2026-05-31' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.total).toBe(1);
    expect(res._json.data[0].id).toBe('scan-2');
  });

  test('7. scanned_by_email is resolved via auth.users join', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const row1 = res._json.data.find((r) => r.scanned_by === USER_ID);
    const row2 = res._json.data.find((r) => r.scanned_by === USER_ID_2);
    expect(row1.scanned_by_email).toBe('abc@example.com');
    expect(row2.scanned_by_email).toBe('def@example.com');
  });

  test('8. invalid assetId → 404', async () => {
    const req = makeReq({ assetId: INVALID_ASSET_ID });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res._json.error).toBe('asset_not_found');
  });

  test('9. no JWT → 401', async () => {
    nextRequireUser = { user: null, error: { status: 401, body: { error: 'missing_token' } } };
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('10. invalid scanned_by UUID → 400', async () => {
    const req = makeReq({ query: { scanned_by: 'not-a-uuid' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/scanned_by/);
  });

  test('11. invalid from_date format → 400', async () => {
    const req = makeReq({ query: { from_date: '2026/05/31' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/from_date/);
  });
});
