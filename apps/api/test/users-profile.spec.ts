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

const PROFILE = { id: 'user2', name: 'Alice', handle: 'alice', image: null, bio: 'Hello!' };

function getProfile(handle: string) {
  return app.request(`/api/users/${handle}`, { method: 'GET' }, BINDINGS);
}

describe('GET /api/users/:handle', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    selectWhereMock = mock(() => Promise.resolve([]));
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await getProfile('alice');
    expect(res.status).toBe(401);
  });

  it('存在する handle を指定するとプロフィールを返す', async () => {
    selectWhereMock = mock(() => Promise.resolve([PROFILE] as unknown[]));

    const res = await getProfile('alice');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(PROFILE);
  });

  it('存在しない handle を指定すると 404 を返す', async () => {
    selectWhereMock = mock(() => Promise.resolve([]));

    const res = await getProfile('nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body).toMatchObject({ error: 'User not found' });
  });

  it('DB エラー時は 500 を返す', async () => {
    selectWhereMock = mock(() => Promise.reject(new Error('db error')));
    const res = await getProfile('alice');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
