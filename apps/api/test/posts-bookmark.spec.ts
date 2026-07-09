import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock((column: unknown, value: unknown) => ({ type: 'eq', column, value }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock }));

// visible post が存在するか（可視性判定の結果を表す）
let mockVisiblePost: { id: number } | undefined = { id: 1 };
// 既に bookmark が存在するか
let mockExistingBookmark: { id: number } | undefined;

const postsWhereMock = mock(() => Promise.resolve(mockVisiblePost ? [mockVisiblePost] : []));
const friendshipsLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: postsWhereMock }));
const postsFromMock = mock((_table: unknown) => ({ leftJoin: friendshipsLeftJoinMock }));

const bookmarksWhereMock = mock(() => Promise.resolve(mockExistingBookmark ? [mockExistingBookmark] : []));
const bookmarksFromMock = mock((_table: unknown) => ({ where: bookmarksWhereMock }));

const postsTable = { id: 'posts.id', userId: 'posts.userId' };
const bookmarksTable = { id: 'bookmarks.id', userId: 'bookmarks.userId', postId: 'bookmarks.postId' };
const friendshipsTable = {
  id: 'friendships.id',
  requesterId: 'friendships.requesterId',
  addresseeId: 'friendships.addresseeId',
  status: 'friendships.status',
};

const selectMock = mock((_fields: unknown) => ({
  from: mock((table: unknown) => (table === bookmarksTable ? bookmarksFromMock(table) : postsFromMock(table))),
}));

let mockInsertError: (Error & { code?: string }) | null = null;
const insertValuesMock = mock(async (_values: unknown) => {
  if (mockInsertError) throw mockInsertError;
  return undefined;
});
const insertMock = mock((_table: unknown) => ({ values: insertValuesMock }));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({ select: selectMock, insert: insertMock }),
  posts: postsTable,
  bookmarks: bookmarksTable,
  friendships: friendshipsTable,
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('POST /api/posts/:id/bookmark', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockVisiblePost = { id: 1 };
    mockExistingBookmark = undefined;
    mockInsertError = null;
    eqMock.mockClear();
    selectMock.mockClear();
    postsFromMock.mockClear();
    bookmarksFromMock.mockClear();
    friendshipsLeftJoinMock.mockClear();
    postsWhereMock.mockClear();
    bookmarksWhereMock.mockClear();
    insertMock.mockClear();
    insertValuesMock.mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('idが数値でない場合は 400 を返す', async () => {
    const res = await req('/api/posts/abc/bookmark', { method: 'POST' });

    expect(res.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('存在しない投稿は 404 を返す', async () => {
    mockVisiblePost = undefined;

    const res = await req('/api/posts/999/bookmark', { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('見えない投稿は 404 を返す', async () => {
    // 非 friend の場合は SQL の where にマッチせず row が返らない想定
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockVisiblePost = undefined;

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('見えない投稿では bookmark insert が走らない', async () => {
    mockVisiblePost = undefined;

    await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(bookmarksFromMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('自分の投稿を初回保存でき、201 { bookmarked: true } を返す', async () => {
    const res = await req('/api/posts/1/bookmark', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ bookmarked: true });
  });

  it('accepted friend の投稿を初回保存でき、201 { bookmarked: true } を返す', async () => {
    mockSessionValue = { user: { id: 'user2', name: 'Friend', email: 'friend@example.com' } };

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ bookmarked: true });
  });

  it('既に保存済みなら 409 { error: "Already bookmarked" } を返す', async () => {
    mockExistingBookmark = { id: 1 };

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: 'Already bookmarked' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('同時リクエストで unique 制約違反(23505)が起きた場合も 409 { error: "Already bookmarked" } を返す', async () => {
    const error = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockInsertError = error;

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: 'Already bookmarked' });
  });

  it('unique 制約違反以外の insert エラーはそのまま投げる（500 になる）', async () => {
    mockInsertError = new Error('connection lost');

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(res.status).toBe(500);
  });

  it('初回保存時は bookmarks に userId = authUser.id, postId = 対象投稿 id で insert される', async () => {
    await req('/api/posts/42/bookmark', { method: 'POST' });

    expect(insertMock).toHaveBeenCalledWith(bookmarksTable);
    expect(insertValuesMock).toHaveBeenCalledWith({ userId: 'user1', postId: 42 });
  });

  it('visibility判定に friendships の JOIN と accepted 判定が使われる', async () => {
    await req('/api/posts/1/bookmark', { method: 'POST' });

    // leftJoin(friendships, postFriendshipCondition(authUser.id)) が実行されている
    expect(friendshipsLeftJoinMock).toHaveBeenCalledTimes(1);
    expect(friendshipsLeftJoinMock.mock.calls[0]?.[0]).toBe(friendshipsTable);

    // postFriendshipCondition(authUser.id) が viewer=authUser.id で friendshipPairCondition を評価している
    expect(eqMock).toHaveBeenCalledWith('friendships.requesterId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.addresseeId', 'user1');

    // where句に本人条件と accepted friend 条件が含まれている
    expect(eqMock).toHaveBeenCalledWith('posts.userId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.status', 'accepted');
  });
});
