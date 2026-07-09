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

const selectWhereMock = mock(() => Promise.resolve(selectResultsQueue.shift() ?? []));
const insertValuesMock = mock((_values: unknown) => ({ returning: () => Promise.resolve(insertReturning) }));
const updateWhereMock = mock((_condition: unknown) => ({ returning: () => Promise.resolve(updateReturning) }));
const updateSetMock = mock((_set: unknown) => ({ where: updateWhereMock }));

const mockDb = {
  select: () => ({ from: () => ({ where: selectWhereMock }) }),
  insert: () => ({ values: insertValuesMock }),
  update: () => ({ set: updateSetMock }),
};

// id/handle 優先ロジックが正しい column で検索しているかを検証するための `eq` スパイ（実装はそのまま通す）
const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock(actualDrizzleOrm.eq);
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock }));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

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

describe('POST /api/friendships', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: CURRENT_USER_ID, name: 'Test User', email: 'test@example.com' } };
    selectResultsQueue = [];
    insertReturning = [];
    updateReturning = [];
    selectWhereMock.mockClear();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
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
    selectWhereMock.mockClear();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
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
