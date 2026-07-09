import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

// `getSession` の戻り値を各テストで切り替える
let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

// `db.select().from().where()` の戻り値を呼び出し順に消費するキュー
let selectResultsQueue: unknown[][] = [];
let insertReturning: unknown[] = [];
let updateReturning: unknown[] = [];

let deleteReturning: unknown[] = [];

const selectWhereMock = mock(() => Promise.resolve(selectResultsQueue.shift() ?? []));
const insertValuesMock = mock((_values: unknown) => ({ returning: () => Promise.resolve(insertReturning) }));
const updateWhereMock = mock((_condition: unknown) => ({ returning: () => Promise.resolve(updateReturning) }));
const updateSetMock = mock((_set: unknown) => ({ where: updateWhereMock }));
const deleteWhereMock = mock((_condition: unknown) => ({ returning: () => Promise.resolve(deleteReturning) }));

const mockDb = {
  select: () => ({ from: () => ({ where: selectWhereMock }) }),
  insert: () => ({ values: insertValuesMock }),
  update: () => ({ set: updateSetMock }),
  delete: () => ({ where: deleteWhereMock }),
};

// id/handle 優先ロジックが正しい column で検索しているかを検証するための `eq`/`and`/`or` スパイ。
// where 系 mock は条件の中身を評価せず常に固定値を返すため、実装が組み立てた条件木そのものを
// タグ付きオブジェクトとして捕捉し、evaluateCondition で行データに対して再評価できるようにする。
type Cond = { __type: 'eq'; col: unknown; val: unknown } | { __type: 'and' | 'or'; conds: Cond[] };

const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock((col: unknown, val: unknown): Cond => ({ __type: 'eq', col, val }));
const andMock = mock((...conds: Cond[]): Cond => ({ __type: 'and', conds }));
const orMock = mock((...conds: Cond[]): Cond => ({ __type: 'or', conds }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock, or: orMock }));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

function columnKey(col: unknown): 'id' | 'status' | 'requesterId' | 'addresseeId' {
  if (col === actualDb.friendships.id) return 'id';
  if (col === actualDb.friendships.status) return 'status';
  if (col === actualDb.friendships.requesterId) return 'requesterId';
  if (col === actualDb.friendships.addresseeId) return 'addresseeId';
  throw new Error('evaluateCondition: unexpected column');
}

function evaluateCondition(cond: Cond, row: Record<string, unknown>): boolean {
  if (cond.__type === 'eq') return row[columnKey(cond.col)] === cond.val;
  if (cond.__type === 'and') return cond.conds.every((c) => evaluateCondition(c, row));
  return cond.conds.some((c) => evaluateCondition(c, row));
}

const { default: app } = await import('../src/index');

const CURRENT_USER_ID = 'user1';
const TARGET_USER = { id: 'user2', name: 'Target User', email: 'target@example.com', handle: 'target-handle' };

function postFriendship(body: unknown) {
  return app.request('/api/friendships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, BINDINGS);
}

function patchFriendship(id: number | string, body: unknown) {
  return app.request(
    `/api/friendships/${id}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    BINDINGS,
  );
}

function deleteFriendship(id: number | string) {
  return app.request(`/api/friendships/${id}`, { method: 'DELETE' }, BINDINGS);
}

describe('POST /api/friendships', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    selectResultsQueue = [];
    insertReturning = [];
    updateReturning = [];
    deleteReturning = [];
    selectWhereMock.mockClear();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
    deleteWhereMock.mockClear();
    eqMock.mockClear();
  });

  it('未接続の相手に id 指定で申請すると 201 を返し、pending 行を INSERT する', async () => {
    selectResultsQueue = [[TARGET_USER], []];
    const createdRow = { id: 1, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'pending' };
    insertReturning = [createdRow];

    const res = await postFriendship({ id: TARGET_USER.id });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(createdRow);
    expect(insertValuesMock).toHaveBeenCalledWith({
      requesterId: CURRENT_USER_ID,
      addresseeId: TARGET_USER.id,
      status: 'pending',
    });
  });

  it('未接続の相手に handle 指定で申請すると 201 を返し、pending 行を INSERT する', async () => {
    selectResultsQueue = [[TARGET_USER], []];
    const createdRow = { id: 2, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'pending' };
    insertReturning = [createdRow];

    const res = await postFriendship({ handle: TARGET_USER.handle });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(createdRow);
  });

  it('denied 状態の相手に再申請すると 201 を返し、既存行を pending に UPDATE する（INSERT はしない）', async () => {
    const existingRow = { id: 5, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'denied' };
    selectResultsQueue = [[TARGET_USER], [existingRow]];
    const updatedRow = { ...existingRow, status: 'pending' };
    updateReturning = [updatedRow];

    const res = await postFriendship({ id: TARGET_USER.id });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(updatedRow);
    expect(updateSetMock).toHaveBeenCalledWith({ status: 'pending' });
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await postFriendship({ id: TARGET_USER.id });
    expect(res.status).toBe(401);
  });

  it('存在しない id を指定すると 404 を返す', async () => {
    selectResultsQueue = [[]];

    const res = await postFriendship({ id: 'nonexistent' });
    expect(res.status).toBe(404);
  });

  it('存在しない handle を指定すると 404 を返す', async () => {
    selectResultsQueue = [[]];

    const res = await postFriendship({ handle: 'nonexistent' });
    expect(res.status).toBe(404);
  });

  it('自分自身の id を指定すると 400 を返す（DB 問い合わせなし）', async () => {
    const res = await postFriendship({ id: CURRENT_USER_ID });

    expect(res.status).toBe(400);
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it('既に pending の相手に再申請すると 409 を返す', async () => {
    const existingRow = { id: 9, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'pending' };
    selectResultsQueue = [[TARGET_USER], [existingRow]];

    const res = await postFriendship({ id: TARGET_USER.id });
    expect(res.status).toBe(409);
  });

  it('既に accepted の相手に再申請すると 409 を返す', async () => {
    const existingRow = { id: 10, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'accepted' };
    selectResultsQueue = [[TARGET_USER], [existingRow]];

    const res = await postFriendship({ id: TARGET_USER.id });
    expect(res.status).toBe(409);
  });

  it('逆方向の申請が既にある場合は新しい申請を作成せず 409 を返す', async () => {
    const existingRow = { id: 11, requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID, status: 'pending' };
    selectResultsQueue = [[TARGET_USER], [existingRow]];

    const res = await postFriendship({ id: TARGET_USER.id });

    expect(res.status).toBe(409);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.requesterId, TARGET_USER.id);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.addresseeId, CURRENT_USER_ID);
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('id も handle も無ければ 400 を返す', async () => {
    const res = await postFriendship({});

    expect(res.status).toBe(400);
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it('id が文字列でなければ無視され 400 を返す', async () => {
    const res = await postFriendship({ id: 123 });

    expect(res.status).toBe(400);
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it('id が文字列でなく handle が併記されていても handle にフォールバックせず 400 を返す', async () => {
    const res = await postFriendship({ id: 123, handle: TARGET_USER.handle });

    expect(res.status).toBe(400);
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it('id と handle を両方指定した場合は id 優先で検索する', async () => {
    selectResultsQueue = [[TARGET_USER], []];
    insertReturning = [{ id: 3, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'pending' }];

    const res = await postFriendship({ id: TARGET_USER.id, handle: 'other-handle' });

    expect(res.status).toBe(201);
    expect(eqMock).toHaveBeenCalledWith(actualDb.user.id, TARGET_USER.id);
    expect(eqMock).not.toHaveBeenCalledWith(actualDb.user.handle, 'other-handle');
  });

  it('INSERT がユニーク制約違反(23505)で失敗した場合は同時実行の競合として 409 を返す', async () => {
    selectResultsQueue = [[TARGET_USER], []];
    insertValuesMock.mockImplementationOnce(() => ({
      returning: () => Promise.reject(Object.assign(new Error('duplicate key'), { code: '23505' })),
    }));

    const res = await postFriendship({ id: TARGET_USER.id });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/friendships/:id', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    selectResultsQueue = [];
    insertReturning = [];
    updateReturning = [];
    deleteReturning = [];
    selectWhereMock.mockClear();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
    deleteWhereMock.mockClear();
    eqMock.mockClear();
  });

  it('受信者本人が accepted に更新すると 200 と更新後行を返す', async () => {
    const updatedRow = { id: 20, requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID, status: 'accepted' };
    updateReturning = [updatedRow];

    const res = await patchFriendship(updatedRow.id, { status: 'accepted' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updatedRow);
    expect(updateSetMock).toHaveBeenCalledWith({ status: 'accepted' });
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.id, updatedRow.id);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.addresseeId, CURRENT_USER_ID);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'pending');
  });

  it('受信者本人が denied に更新すると 200 と更新後行を返す', async () => {
    const updatedRow = { id: 21, requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID, status: 'denied' };
    updateReturning = [updatedRow];

    const res = await patchFriendship(updatedRow.id, { status: 'denied' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updatedRow);
    expect(updateSetMock).toHaveBeenCalledWith({ status: 'denied' });
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await patchFriendship(22, { status: 'accepted' });

    expect(res.status).toBe(401);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('他人宛ての申請は 404 を返す', async () => {
    updateReturning = [];

    const res = await patchFriendship(23, { status: 'accepted' });

    expect(res.status).toBe(404);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.id, 23);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.addresseeId, CURRENT_USER_ID);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'pending');
  });

  it('自分が送った申請は 404 を返す', async () => {
    updateReturning = [];

    const res = await patchFriendship(24, { status: 'accepted' });

    expect(res.status).toBe(404);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.addresseeId, CURRENT_USER_ID);
  });

  it('存在しない申請は 404 を返す', async () => {
    updateReturning = [];

    const res = await patchFriendship(25, { status: 'accepted' });

    expect(res.status).toBe(404);
  });

  it('既に accepted 済みの friendship は 404 を返す', async () => {
    updateReturning = [];

    const res = await patchFriendship(26, { status: 'denied' });

    expect(res.status).toBe(404);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'pending');
  });

  it('既に denied 済みの friendship は 404 を返す', async () => {
    updateReturning = [];

    const res = await patchFriendship(27, { status: 'accepted' });

    expect(res.status).toBe(404);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'pending');
  });

  it('body が JSON として不正なら 400 を返す', async () => {
    const res = await app.request('/api/friendships/28', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{' }, BINDINGS);

    expect(res.status).toBe(400);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('status がないなら 400 を返す', async () => {
    const res = await patchFriendship(29, {});

    expect(res.status).toBe(400);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('status が accepted / denied 以外なら 400 を返す', async () => {
    const res = await patchFriendship(30, { status: 'pending' });

    expect(res.status).toBe(400);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('id が数値でなければ 400 を返す（DB 問い合わせなし）', async () => {
    const res = await patchFriendship('abc', { status: 'accepted' });

    expect(res.status).toBe(400);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('id が 0 以下なら 400 を返す（DB 問い合わせなし）', async () => {
    const res = await patchFriendship(-1, { status: 'accepted' });

    expect(res.status).toBe(400);
    expect(updateSetMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/friendships/:id', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    selectResultsQueue = [];
    insertReturning = [];
    updateReturning = [];
    deleteReturning = [];
    selectWhereMock.mockClear();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
    deleteWhereMock.mockClear();
    eqMock.mockClear();
  });

  it('pending の申請を requester 本人が削除すると 200 と削除行を返す', async () => {
    const deletedRow = { id: 40, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'pending' };
    deleteReturning = [deletedRow];

    const res = await deleteFriendship(deletedRow.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(deletedRow);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.id, deletedRow.id);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'pending');
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.status, 'accepted');
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.requesterId, CURRENT_USER_ID);
    expect(eqMock).toHaveBeenCalledWith(actualDb.friendships.addresseeId, CURRENT_USER_ID);
  });

  it('pending の申請を addressee 側が削除しようとすると 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteFriendship(41);

    expect(res.status).toBe(404);
  });

  it('accepted のフレンドを requester 本人が削除すると 200 と削除行を返す', async () => {
    const deletedRow = { id: 42, requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id, status: 'accepted' };
    deleteReturning = [deletedRow];

    const res = await deleteFriendship(deletedRow.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(deletedRow);
  });

  it('accepted のフレンドを addressee 本人が削除すると 200 と削除行を返す', async () => {
    const deletedRow = { id: 43, requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID, status: 'accepted' };
    deleteReturning = [deletedRow];

    const res = await deleteFriendship(deletedRow.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(deletedRow);
  });

  it('無関係ユーザーの friendship は 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteFriendship(44);

    expect(res.status).toBe(404);
  });

  it('存在しない friendship は 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteFriendship(999);

    expect(res.status).toBe(404);
  });

  it('denied の friendship は requester でも 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteFriendship(45);

    expect(res.status).toBe(404);
  });

  it('denied の friendship は addressee でも 404 を返す', async () => {
    deleteReturning = [];

    const res = await deleteFriendship(46);

    expect(res.status).toBe(404);
  });

  it('未認証で叩くと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await deleteFriendship(47);

    expect(res.status).toBe(401);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it('id が数値でなければ 400 を返す（DB 問い合わせなし）', async () => {
    const res = await deleteFriendship('abc');

    expect(res.status).toBe(400);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it('id が 0 以下なら 400 を返す（DB 問い合わせなし）', async () => {
    const res = await deleteFriendship(-1);

    expect(res.status).toBe(400);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it('WHERE 条件が仕様通りに行を絞り込む（mock DB は条件を評価しないため条件木を直接検証する）', async () => {
    deleteReturning = [];
    await deleteFriendship(50);
    const condition = deleteWhereMock.mock.calls[0]?.[0] as Cond;
    const matches = (row: Record<string, unknown>) => evaluateCondition(condition, row);

    // pending: requester 本人のみ true
    expect(matches({ id: 50, status: 'pending', requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id })).toBe(true);
    expect(matches({ id: 50, status: 'pending', requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID })).toBe(false);

    // accepted: requester / addressee どちらも true
    expect(matches({ id: 50, status: 'accepted', requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id })).toBe(true);
    expect(matches({ id: 50, status: 'accepted', requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID })).toBe(true);

    // denied: 誰であっても false
    expect(matches({ id: 50, status: 'denied', requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id })).toBe(false);
    expect(matches({ id: 50, status: 'denied', requesterId: TARGET_USER.id, addresseeId: CURRENT_USER_ID })).toBe(false);

    // id が一致しない、または無関係ユーザーは false
    expect(matches({ id: 999, status: 'pending', requesterId: CURRENT_USER_ID, addresseeId: TARGET_USER.id })).toBe(false);
    expect(matches({ id: 50, status: 'pending', requesterId: 'someone-else', addresseeId: 'another-one' })).toBe(false);
  });
});
