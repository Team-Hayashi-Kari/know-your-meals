import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

type MockRow =
  | { total: number }
  | { id: string; name: string; handle: string; image: null }
  | { id: number; status: string; requesterId: string; addresseeId: string };

// db.select().from().where() の戻り値を呼び出し順に消費するキュー。
// count クエリ・friendship 行クエリは where() を直接 await するが、
// ユーザー一覧クエリは where().orderBy().limit().offset() まで辿って初めて解決する。
// where() の時点では消費せず、実際に解決される箇所(then / offset)でのみ1つ消費する。
let selectResultsQueue: MockRow[][] = [];
const dequeue = mock(() => Promise.resolve(selectResultsQueue.shift() ?? []));

const lazyThenable = () => ({
  // biome-ignore lint/suspicious/noThenProperty: Drizzle の awaitable chain mock のため意図的な thenable
  then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => dequeue().then(resolve, reject),
});

const mockDb = {
  select: (_fields?: unknown) => ({
    from: () => ({
      where: () => ({
        ...lazyThenable(),
        orderBy: () => ({ limit: () => ({ offset: () => lazyThenable() }) }),
      }),
    }),
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
    selectResultsQueue = [];
    dequeue.mockClear();
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
    selectResultsQueue = [[{ total: 2 }], [USER_A, USER_B], []];

    const res = await search({ q: 'alice' });
    expect(res.status).toBe(200);
    const body = await res.json<{ users: unknown[]; nextPage: number | null }>();
    expect(body.nextPage).toBeNull();
  });

  it('次ページがある場合は nextPage に次のページ番号を返す', async () => {
    selectResultsQueue = [[{ total: 100 }], [USER_A], []];

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
    selectResultsQueue = [];
    dequeue.mockImplementationOnce(() => Promise.reject(new Error('db error')));
    const res = await search({ q: 'alice' });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('検索結果に relationshipStatus と friendshipId が含まれる(friendship なし)', async () => {
    selectResultsQueue = [[{ total: 1 }], [USER_A], []];

    const res = await search({ q: 'alice' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users[0]).toMatchObject({ id: USER_A.id, relationshipStatus: 'none', friendshipId: null });
  });

  it('pending requester 側は pending_sent を返す', async () => {
    const row = { id: 1, status: 'pending', requesterId: CURRENT_USER.id, addresseeId: USER_A.id };
    selectResultsQueue = [[{ total: 1 }], [USER_A], [row]];

    const res = await search({ q: 'alice' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users[0]).toMatchObject({ relationshipStatus: 'pending_sent', friendshipId: 1 });
  });

  it('pending addressee 側は pending_received を返す', async () => {
    const row = { id: 2, status: 'pending', requesterId: USER_A.id, addresseeId: CURRENT_USER.id };
    selectResultsQueue = [[{ total: 1 }], [USER_A], [row]];

    const res = await search({ q: 'alice' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users[0]).toMatchObject({ relationshipStatus: 'pending_received', friendshipId: 2 });
  });

  it('accepted は friends を返す', async () => {
    const row = { id: 3, status: 'accepted', requesterId: CURRENT_USER.id, addresseeId: USER_A.id };
    selectResultsQueue = [[{ total: 1 }], [USER_A], [row]];

    const res = await search({ q: 'alice' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users[0]).toMatchObject({ relationshipStatus: 'friends', friendshipId: 3 });
  });

  it('denied は none を返す', async () => {
    const row = { id: 4, status: 'denied', requesterId: CURRENT_USER.id, addresseeId: USER_A.id };
    selectResultsQueue = [[{ total: 1 }], [USER_A], [row]];

    const res = await search({ q: 'alice' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users[0]).toMatchObject({ relationshipStatus: 'none', friendshipId: null });
  });

  it('複数ユーザーそれぞれに正しい relationshipStatus が付く', async () => {
    const rowB = { id: 5, status: 'accepted', requesterId: USER_B.id, addresseeId: CURRENT_USER.id };
    selectResultsQueue = [[{ total: 2 }], [USER_A, USER_B], [rowB]];

    const res = await search({ q: 'a' });
    const body = await res.json<{ users: Array<Record<string, unknown>> }>();
    expect(body.users.find((u) => u.id === USER_A.id)).toMatchObject({ relationshipStatus: 'none', friendshipId: null });
    expect(body.users.find((u) => u.id === USER_B.id)).toMatchObject({ relationshipStatus: 'friends', friendshipId: 5 });
  });
});
