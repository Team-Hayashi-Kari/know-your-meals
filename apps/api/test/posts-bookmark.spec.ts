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
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock }));

function columnKey(col: unknown): 'userId' | 'postId' {
  if (col === actualDb.bookmarks.userId) return 'userId';
  if (col === actualDb.bookmarks.postId) return 'postId';
  throw new Error('evaluateCondition: unexpected column');
}

function evaluateCondition(cond: Cond, row: Record<string, unknown>): boolean {
  if (cond.__type === 'eq') return row[columnKey(cond.col)] === cond.val;
  return cond.conds.every((c) => evaluateCondition(c, row));
}

let deleteReturning: unknown[] = [];
const deleteWhereMock = mock((_condition: unknown) => ({ returning: () => Promise.resolve(deleteReturning) }));
const mockDb = { delete: () => ({ where: deleteWhereMock }) };

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

const { default: app } = await import('../src/index');

const CURRENT_USER_ID = 'user1';

function deleteBookmark(id: number | string) {
  return app.request(`/api/posts/${id}/bookmark`, { method: 'DELETE' }, BINDINGS);
}

describe('DELETE /api/posts/:id/bookmark', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    deleteReturning = [];
    deleteWhereMock.mockClear();
    eqMock.mockClear();
    andMock.mockClear();
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
    expect(eqMock).toHaveBeenCalledWith(actualDb.bookmarks.userId, CURRENT_USER_ID);
    expect(eqMock).toHaveBeenCalledWith(actualDb.bookmarks.postId, 101);
  });

  it('bookmark が存在しない場合は 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteBookmark(999);

    expect(res.status).toBe(404);
  });

  it('他人の bookmark しか存在しない場合は 404 を返す（WHERE条件で自分の行のみ対象）', async () => {
    deleteReturning = [];
    await deleteBookmark(102);

    const condition = deleteWhereMock.mock.calls[0]?.[0] as Cond;
    const matches = (row: Record<string, unknown>) => evaluateCondition(condition, row);

    expect(matches({ userId: CURRENT_USER_ID, postId: 102 })).toBe(true);
    expect(matches({ userId: 'user2', postId: 102 })).toBe(false);
  });

  it(':id が不正な場合は 404 を返す（DB問い合わせなし）', async () => {
    const res = await deleteBookmark('abc');

    expect(res.status).toBe(404);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it(':id が 0 以下の場合は 404 を返す（DB問い合わせなし）', async () => {
    const res = await deleteBookmark(-1);

    expect(res.status).toBe(404);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });
});
