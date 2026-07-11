import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

let selectWhereMock = mock(() => Promise.resolve([] as unknown[]));

const mockDb = {
  select: (_fields?: unknown) => ({
    from: () => ({
      where: () => selectWhereMock(),
    }),
  }),
};

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

const { default: app } = await import('../src/index');

function checkHandle(handle: string) {
  return app.request(`/api/users/check-handle?handle=${encodeURIComponent(handle)}`, { method: 'GET' }, BINDINGS);
}

describe('GET /api/users/check-handle', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    selectWhereMock = mock(() => Promise.resolve([]));
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await checkHandle('alice');

    expect(res.status).toBe(401);
  });

  it('未使用の handle なら available: true を返す', async () => {
    selectWhereMock = mock(() => Promise.resolve([]));

    const res = await checkHandle('new_user');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ available: true });
  });

  it('他ユーザーが使っている handle なら available: false を返す', async () => {
    selectWhereMock = mock(() => Promise.resolve([{ id: 'user2' }]));

    const res = await checkHandle('alice');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ available: false });
  });

  it('不正な handle は 400 を返す', async () => {
    const res = await checkHandle('abc.def');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid handle' });
  });

  it('DB エラー時は 500 を返す', async () => {
    selectWhereMock = mock(() => Promise.reject(new Error('db error')));

    const res = await checkHandle('alice');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
