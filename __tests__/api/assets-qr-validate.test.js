// __tests__/api/assets-qr-validate.test.js
// Handler-level tests for GET /api/assets/qr-validate.

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

const VALID_ASSET_ID = '11111111-1111-1111-1111-111111111111';

// Fixture: one asset.
const ASSET = {
  id: VALID_ASSET_ID,
  name_en: 'CNC LATHE #1',
  machine_asset_number: 'DCMI-MFG-CNC-01',
  serial_no: 'SN-12345',
  location: 'BAY-A',
  status: 'active',
  qr_payload: 'DCMI-MFG-CNC-01',
};

let nextRequireUser = { user: { id: 'user-abc' }, error: null };

jest.mock('../../lib/career-auth', () => ({
  requireUser: jest.fn(async () => nextRequireUser),
}));

jest.mock('../../lib/supabase-admin', () => {
  const fromImpl = (table) => {
    const state = { table, eqCol: null, eqVal: null };
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((col, val) => {
        state.eqCol = col;
        state.eqVal = val;
        return chain;
      }),
      maybeSingle: jest.fn(async () => {
        if (state.table !== 'assets') return { data: null, error: null };
        const a = global.__ASSET_FIXTURE__;
        if (!a) return { data: null, error: null };
        if (a[state.eqCol] === state.eqVal) {
          return {
            data: {
              id: a.id,
              name_en: a.name_en,
              machine_asset_number: a.machine_asset_number,
              serial_no: a.serial_no,
              location: a.location,
              status: a.status,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  };

  return { supabaseAdmin: { from: jest.fn(fromImpl) } };
});

const handler = require('../../pages/api/assets/qr-validate').default;

function makeReq({ method = 'GET', query = {}, headers = {} } = {}) {
  return {
    method,
    query,
    body: {},
    headers: {
      authorization: 'Bearer fake.jwt.token',
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
  global.__ASSET_FIXTURE__ = { ...ASSET };
  nextRequireUser = { user: { id: 'user-abc' }, error: null };
});

describe('GET /api/assets/qr-validate', () => {
  test('1. valid machine_asset_number payload → 200 + summary', async () => {
    const req = makeReq({ query: { payload: 'DCMI-MFG-CNC-01' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.asset_id).toBe(VALID_ASSET_ID);
    expect(res._json.asset_name).toBe('CNC LATHE #1');
    expect(res._json.machine_asset_number).toBe('DCMI-MFG-CNC-01');
    expect(res._json.serial_number).toBe('SN-12345');
    expect(res._json.location).toBe('BAY-A');
    expect(res._json.status).toBe('active');
  });

  test('2. URL-form payload with /assets/<id>/qr-validate → 200', async () => {
    const url = `https://dsc-fms-portal.vercel.app/assets/${VALID_ASSET_ID}/qr-validate`;
    const req = makeReq({ query: { payload: url } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.asset_id).toBe(VALID_ASSET_ID);
  });

  test('3. unknown payload → 404', async () => {
    const req = makeReq({ query: { payload: 'NOT-AN-ASSET' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res._json.error).toBe('asset_not_found');
  });

  test('4. missing payload query param → 400', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/payload/);
  });

  test('5. empty payload string → 400', async () => {
    const req = makeReq({ query: { payload: '   ' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('6. no JWT → 401', async () => {
    nextRequireUser = {
      user: null,
      error: { status: 401, body: { error: 'missing_token' } },
    };
    const req = makeReq({ query: { payload: 'DCMI-MFG-CNC-01' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('7. non-GET → 405', async () => {
    const req = makeReq({ method: 'POST', query: { payload: 'X' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  test('8. URL with query string is parsed correctly', async () => {
    const url = `https://example.com/assets/${VALID_ASSET_ID}/qr-validate?utm=qr`;
    const req = makeReq({ query: { payload: url } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.asset_id).toBe(VALID_ASSET_ID);
  });
});
