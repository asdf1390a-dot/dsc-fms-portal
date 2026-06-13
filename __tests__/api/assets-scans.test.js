// __tests__/api/assets-scans.test.js
// Handler-level tests for POST /api/assets/[assetId]/scans.
//
// Pattern mirrors __tests__/api/team-dashboard-phase2.test.ts:
//   - Mocks supabase-admin + career-auth at the module level.
//   - Invokes the Pages Router handler with a fake req/res.
//
// Run with jest (project-level jest config required; this file follows the
// repo's established test style — see team-dashboard-phase2.test.ts).

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// -------------------- Mocks --------------------

const VALID_ASSET_ID = '11111111-1111-1111-1111-111111111111';
const INVALID_ASSET_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-abc';

// Tracks inserted rows so we can assert on side effects.
let insertedRows = [];

// requireUser mock state
let nextRequireUser = { user: { id: USER_ID }, error: null };

jest.mock('../../lib/career-auth', () => ({
  requireUser: jest.fn(async () => nextRequireUser),
}));

// supabase-admin mock — minimal fluent API covering .from().select().eq().maybeSingle()
// and .from().insert().select().single().
jest.mock('../../lib/supabase-admin', () => {
  const fromImpl = (table) => {
    const state = { table, action: null, insertPayload: null, eqVal: null };

    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((_col, val) => {
        state.eqVal = val;
        return chain;
      }),
      insert: jest.fn((payload) => {
        state.action = 'insert';
        state.insertPayload = payload;
        return chain;
      }),
      maybeSingle: jest.fn(async () => {
        if (state.table === 'assets') {
          if (state.eqVal === VALID_ASSET_ID) {
            return { data: { id: VALID_ASSET_ID }, error: null };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }),
      single: jest.fn(async () => {
        if (state.table === 'asset_qr_scans' && state.action === 'insert') {
          const row = {
            id: `scan-${insertedRows.length + 1}`,
            asset_id: state.insertPayload.asset_id,
            qr_payload: state.insertPayload.qr_payload,
            scanned_at: new Date().toISOString(),
            scanned_by: state.insertPayload.scanned_by,
            device_info: state.insertPayload.device_info,
            location_gps: state.insertPayload.location_gps,
          };
          insertedRows.push(row);
          return { data: row, error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  };

  return {
    supabaseAdmin: { from: jest.fn(fromImpl) },
  };
});

// Import handler AFTER mocks.
const handler = require('../../pages/api/assets/[assetId]/scans').default;

// -------------------- Test helpers --------------------

function makeReq({ method = 'POST', assetId = VALID_ASSET_ID, body = {}, headers = {} } = {}) {
  return {
    method,
    query: { assetId },
    body,
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
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res._json = body;
    return res;
  });
  res.setHeader = jest.fn((k, v) => {
    res._headers[k] = v;
    return res;
  });
  res.send = jest.fn((body) => {
    res._json = body;
    return res;
  });
  return res;
}

beforeEach(() => {
  insertedRows = [];
  nextRequireUser = { user: { id: USER_ID }, error: null };
});

// -------------------- Tests --------------------

describe('POST /api/assets/[assetId]/scans', () => {
  test('1. valid payload → 201 + record', async () => {
    const req = makeReq({
      body: {
        qr_payload: 'https://dsc-fms-portal.vercel.app/assets/abc/qr-validate',
        device_info: 'Mozilla/5.0',
        location_gps: '12.9716,77.5946',
      },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.id).toBeDefined();
    expect(res._json.asset_id).toBe(VALID_ASSET_ID);
    expect(res._json.qr_payload).toBe(
      'https://dsc-fms-portal.vercel.app/assets/abc/qr-validate'
    );
    expect(res._json.location_gps).toBe('12.9716,77.5946');
  });

  test('2. missing qr_payload → 400', async () => {
    const req = makeReq({ body: { device_info: 'X' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/qr_payload/);
  });

  test('3. invalid asset_id → 404', async () => {
    const req = makeReq({
      assetId: INVALID_ASSET_ID,
      body: { qr_payload: 'payload' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res._json.error).toBe('asset_not_found');
  });

  test('4. no JWT → 401', async () => {
    nextRequireUser = {
      user: null,
      error: { status: 401, body: { error: 'missing_token' } },
    };
    const req = makeReq({ body: { qr_payload: 'payload' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._json.error).toBe('missing_token');
  });

  test('5. malformed location_gps → 400', async () => {
    const req = makeReq({
      body: { qr_payload: 'payload', location_gps: '12.97' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/location_gps/);
  });

  test('6. missing device_info → defaults to user-agent, 201', async () => {
    const req = makeReq({
      body: { qr_payload: 'payload' },
      headers: { 'user-agent': 'CustomUA/9.9' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.device_info).toBe('CustomUA/9.9');
  });

  test('7. scanned_by equals current user.id', async () => {
    const req = makeReq({ body: { qr_payload: 'payload' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.scanned_by).toBe(USER_ID);
  });

  test('8. scanned_at is a timestamp (not null)', async () => {
    const req = makeReq({ body: { qr_payload: 'payload' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.scanned_at).toBeTruthy();
    expect(Number.isNaN(Date.parse(res._json.scanned_at))).toBe(false);
  });

  test('9. successful insert increases asset_qr_scans count by 1', async () => {
    const before = insertedRows.length;
    const req = makeReq({ body: { qr_payload: 'payload' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(insertedRows.length).toBe(before + 1);
  });

  test('10. multiple scans on same asset → all inserted, FK valid', async () => {
    for (let i = 0; i < 3; i++) {
      const req = makeReq({ body: { qr_payload: `payload-${i}` } });
      const res = makeRes();
      await handler(req, res);
      expect(res.statusCode).toBe(201);
    }
    expect(insertedRows.length).toBe(3);
    expect(insertedRows.every((r) => r.asset_id === VALID_ASSET_ID)).toBe(true);
  });

  test('bonus: non-POST → 405', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
