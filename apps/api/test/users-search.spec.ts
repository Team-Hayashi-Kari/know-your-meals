import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

type MockRow = { total: number } | { id: string; name: string; handle: string; image: null };
let selectFromWhereMock = mock(() => Promise.resolve([] as MockRow[]));

const mockDb = {
  select: (_fields?: unknown) => ({
    from: () => {
      const whereChain = () => {
        const promise = selectFromWhereMock();
        // count クエリは where() を直接 await、select クエリは orderBy チェーンを使う
        return Object.assign(promise, {
          orderBy: () => ({ limit: () => ({ offset: () => selectFromWhereMock() }) }),
        });
      };
      return { leftJoin: () => ({ where: whereChain }), where: whereChain };
    },
  }),
};

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

const { default: app } = await import('../src/index');

const CURRENT_USER = { id: 'user1', name: 'Test User', email: 'test@example.com' };
const USER_A = { id: 'user2', name: 'Alice', handle: 'alice', image: null };
const USER_B = { id: 'user3', name: 'Bob', handle: 'bob_handle', image: null };

function search(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return app.request(`/api/users/search?${qs}`, { method: 'GET' }, BINDINGS);
}

describe('GET /api/users/search', () => {
  beforeEach(() => {
    mockSessionValue = { user: CURRENT_USER };
    selectFromWhereMock = mock(() => Promise.resolve([] as MockRow[]));
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await search({ q: 'alice' });
    expect(res.status).toBe(401);
  });

  it('q が空文字のとき 400 を返す', async () => {
    const res = await search({ q: '' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'q is required' });
  });

  it('q が "@" のみのとき 400 を返す', async () => {
    const res = await search({ q: '@' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'q is required' });
  });

  it('page が数値でないとき 400 を返す', async () => {
    const res = await search({ q: 'alice', page: 'abc' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'invalid page/limit' });
  });

  it('limit が数値でないとき 400 を返す', async () => {
    const res = await search({ q: 'alice', limit: 'abc' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'invalid page/limit' });
  });

  it('page が空文字のとき 400 を返す', async () => {
    const res = await search({ q: 'alice', page: '' });
    expect(res.status).toBe(400);
  });

  it('limit が空文字のとき 400 を返す', async () => {
    const res = await search({ q: 'alice', limit: '' });
    expect(res.status).toBe(400);
  });

  it('ヒットしたユーザーを返し、最終ページなら nextPage が null', async () => {
    // count → [5件], select → [USER_A, USER_B]
    selectFromWhereMock = mock(() => Promise.resolve((selectFromWhereMock.mock.calls.length === 1 ? [{ total: 2 }] : [USER_A, USER_B]) as MockRow[]));

    const res = await search({ q: 'alice' });
    expect(res.status).toBe(200);
    const body = await res.json<{ users: unknown[]; nextPage: number | null }>();
    expect(body.nextPage).toBeNull();
  });

  it('次ページがある場合は nextPage に次のページ番号を返す', async () => {
    let call = 0;
    selectFromWhereMock = mock(() => {
      call++;
      return Promise.resolve((call === 1 ? [{ total: 100 }] : [USER_A]) as MockRow[]);
    });

    const res = await search({ q: 'alice', page: '1', limit: '1' });
    expect(res.status).toBe(200);
    const body = await res.json<{ nextPage: number | null }>();
    expect(body.nextPage).toBe(2);
  });

  it('q なしでリクエストすると 400 を返す', async () => {
    const res = await app.request('/api/users/search', { method: 'GET' }, BINDINGS);
    expect(res.status).toBe(400);
  });

  it('DB エラー時は 500 を返す', async () => {
    let callCount = 0;
    selectFromWhereMock = mock(() => {
      callCount++;
      // 1回目（count クエリ）だけ reject。2回目以降は解決させて unhandled rejection を防ぐ
      if (callCount === 1) return Promise.reject(new Error('db error'));
      return Promise.resolve([]);
    });
    const res = await search({ q: 'alice' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
