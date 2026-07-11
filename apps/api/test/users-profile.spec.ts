import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

// db.select().from().where() の戻り値を呼び出し順に消費するキュー。
// 実装は found user → postCount → friendCount → friendshipRow の順で問い合わせる。
let selectResultsQueue: unknown[][] = [];
let selectWhereMock = mock(() => Promise.resolve(selectResultsQueue.shift() ?? []));

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
const POST_COUNT = [{ total: 3 }];
const FRIEND_COUNT = [{ total: 5 }];

function getProfile(handle: string) {
  return app.request(`/api/users/${handle}`, { method: 'GET' }, BINDINGS);
}

describe('GET /api/users/:handle', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    selectResultsQueue = [];
    selectWhereMock = mock(() => Promise.resolve(selectResultsQueue.shift() ?? []));
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await getProfile('alice');
    expect(res.status).toBe(401);
  });

  it('存在しない handle を指定すると 404 を返す', async () => {
    selectResultsQueue = [[]];

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

  it('friendship なしの場合 relationshipStatus は none, friendshipId は null', async () => {
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, []];

    const res = await getProfile('alice');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ...PROFILE, postCount: 3, friendCount: 5, relationshipStatus: 'none', friendshipId: null });
  });

  it('自分から申請中の場合 pending_sent を返す', async () => {
    const friendshipRow = { id: 10, status: 'pending', requesterId: 'user1', addresseeId: 'user2' };
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, [friendshipRow]];

    const res = await getProfile('alice');
    const body = await res.json();
    expect(body).toMatchObject({ relationshipStatus: 'pending_sent', friendshipId: 10 });
  });

  it('相手から申請中の場合 pending_received を返す', async () => {
    const friendshipRow = { id: 11, status: 'pending', requesterId: 'user2', addresseeId: 'user1' };
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, [friendshipRow]];

    const res = await getProfile('alice');
    const body = await res.json();
    expect(body).toMatchObject({ relationshipStatus: 'pending_received', friendshipId: 11 });
  });

  it('accepted の場合 friends を返す', async () => {
    const friendshipRow = { id: 12, status: 'accepted', requesterId: 'user1', addresseeId: 'user2' };
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, [friendshipRow]];

    const res = await getProfile('alice');
    const body = await res.json();
    expect(body).toMatchObject({ relationshipStatus: 'friends', friendshipId: 12 });
  });

  it('denied の場合 none を返す(friendshipId も null)', async () => {
    const friendshipRow = { id: 13, status: 'denied', requesterId: 'user1', addresseeId: 'user2' };
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, [friendshipRow]];

    const res = await getProfile('alice');
    const body = await res.json();
    expect(body).toMatchObject({ relationshipStatus: 'none', friendshipId: null });
  });

  it('postCount / friendCount が返る', async () => {
    selectResultsQueue = [[PROFILE], [{ total: 7 }], [{ total: 2 }], []];

    const res = await getProfile('alice');
    const body = await res.json();
    expect(body).toMatchObject({ postCount: 7, friendCount: 2 });
  });

  it('先頭に @ が付いていても handle 検索できる', async () => {
    selectResultsQueue = [[PROFILE], POST_COUNT, FRIEND_COUNT, []];

    const res = await getProfile('@alice');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ handle: 'alice' });
  });
});
