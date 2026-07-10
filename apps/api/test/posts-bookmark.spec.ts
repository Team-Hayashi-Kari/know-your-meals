import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

type Cond = { __type: 'eq'; col: unknown; val: unknown } | { __type: 'and' | 'or'; conds: Cond[] };

const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock((col: unknown, val: unknown): Cond => ({ __type: 'eq', col, val }));
const andMock = mock((...conds: Cond[]): Cond => ({ __type: 'and', conds }));
const orMock = mock((...conds: Cond[]): Cond => ({ __type: 'or', conds }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock, or: orMock }));

const postsTable = { id: 'posts.id', userId: 'posts.userId' };
const bookmarksTable = { id: 'bookmarks.id', userId: 'bookmarks.userId', postId: 'bookmarks.postId' };
const friendshipsTable = {
  id: 'friendships.id',
  requesterId: 'friendships.requesterId',
  addresseeId: 'friendships.addresseeId',
  status: 'friendships.status',
};

function columnKey(col: unknown): 'userId' | 'postId' {
  if (col === bookmarksTable.userId) return 'userId';
  if (col === bookmarksTable.postId) return 'postId';
  throw new Error('evaluateCondition: unexpected column');
}

function evaluateCondition(cond: Cond, row: Record<string, unknown>): boolean {
  if (cond.__type === 'eq') return row[columnKey(cond.col)] === cond.val;
  if (cond.__type === 'or') return cond.conds.some((c) => evaluateCondition(c, row));
  return cond.conds.every((c) => evaluateCondition(c, row));
}

let deleteReturning: unknown[] = [];
const deleteWhereMock = mock((_condition: unknown) => ({ returning: () => Promise.resolve(deleteReturning) }));
const deleteMock = mock((_table: unknown) => ({ where: deleteWhereMock }));

let mockRow: { id: number; bookmarkId: number | null } | undefined = { id: 1, bookmarkId: null };
const whereMock = mock(() => Promise.resolve(mockRow ? [mockRow] : []));
const bookmarksLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: whereMock }));
const friendshipsLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: bookmarksLeftJoinMock }));
const fromMock = mock((_table: unknown) => ({ leftJoin: friendshipsLeftJoinMock }));
const selectMock = mock((_fields: unknown) => ({ from: fromMock }));

let mockInsertError: (Error & { code?: string }) | null = null;
const insertValuesMock = mock(async (_values: unknown) => {
  if (mockInsertError) throw mockInsertError;
  return undefined;
});
const insertMock = mock((_table: unknown) => ({ values: insertValuesMock }));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({ select: selectMock, insert: insertMock, delete: deleteMock }),
  posts: postsTable,
  bookmarks: bookmarksTable,
  friendships: friendshipsTable,
}));

const { default: app } = await import('../src/index');

const CURRENT_USER_ID = 'user1';

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

function deleteBookmark(id: number | string) {
  return req(`/api/posts/${id}/bookmark`, { method: 'DELETE' });
}

describe('DELETE /api/posts/:id/bookmark', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    deleteReturning = [];
    deleteMock.mockClear();
    deleteWhereMock.mockClear();
    eqMock.mockClear();
    andMock.mockClear();
    orMock.mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await deleteBookmark(1);

    expect(res.status).toBe(401);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it('自分の bookmark が存在する場合は削除して 204 を返す', async () => {
    deleteReturning = [{ id: 1, userId: CURRENT_USER_ID, postId: 101 }];

    const res = await deleteBookmark(101);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(deleteMock).toHaveBeenCalledWith(bookmarksTable);
    expect(eqMock).toHaveBeenCalledWith(bookmarksTable.userId, CURRENT_USER_ID);
    expect(eqMock).toHaveBeenCalledWith(bookmarksTable.postId, 101);
  });

  it('bookmark が存在しない場合は 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteBookmark(999);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Bookmark not found' });
  });

  it('他人の bookmark しか存在しない場合は 404 を返す（WHERE条件で自分の行のみ対象）', async () => {
    deleteReturning = [];
    await deleteBookmark(102);

    const condition = deleteWhereMock.mock.calls[0]?.[0] as Cond;
    const matches = (row: Record<string, unknown>) => evaluateCondition(condition, row);

    expect(matches({ userId: CURRENT_USER_ID, postId: 102 })).toBe(true);
    expect(matches({ userId: 'user2', postId: 102 })).toBe(false);
  });

  it(':id が不正な場合は 400 を返す（DB問い合わせなし）', async () => {
    const res = await deleteBookmark('abc');

    expect(res.status).toBe(400);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it(':id が 0 以下の場合は 400 を返す（DB問い合わせなし）', async () => {
    const res = await deleteBookmark(-1);

    expect(res.status).toBe(400);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/posts/:id/bookmark', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockRow = { id: 1, bookmarkId: null };
    mockInsertError = null;
    eqMock.mockClear();
    andMock.mockClear();
    orMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    friendshipsLeftJoinMock.mockClear();
    bookmarksLeftJoinMock.mockClear();
    whereMock.mockClear();
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
    mockRow = undefined;

    const res = await req('/api/posts/999/bookmark', { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('見えない投稿は 404 を返す', async () => {
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockRow = undefined;

    const res = await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('見えない投稿では bookmark insert が走らない', async () => {
    mockRow = undefined;

    await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('可視性確認とbookmark確認を1クエリにまとめている（N+1回避）', async () => {
    await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(bookmarksLeftJoinMock).toHaveBeenCalledTimes(1);
    expect(bookmarksLeftJoinMock.mock.calls[0]?.[0]).toBe(bookmarksTable);
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
    mockRow = { id: 1, bookmarkId: 5 };

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
    mockRow = { id: 42, bookmarkId: null };

    await req('/api/posts/42/bookmark', { method: 'POST' });

    expect(insertMock).toHaveBeenCalledWith(bookmarksTable);
    expect(insertValuesMock).toHaveBeenCalledWith({ userId: 'user1', postId: 42 });
  });

  it('visibility判定に friendships の JOIN と accepted 判定が使われる', async () => {
    await req('/api/posts/1/bookmark', { method: 'POST' });

    expect(friendshipsLeftJoinMock).toHaveBeenCalledTimes(1);
    expect(friendshipsLeftJoinMock.mock.calls[0]?.[0]).toBe(friendshipsTable);

    expect(eqMock).toHaveBeenCalledWith('friendships.requesterId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.addresseeId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('posts.userId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.status', 'accepted');
  });
});
