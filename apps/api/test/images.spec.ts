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
const andMock = mock((...args: unknown[]) => ({ type: 'and', args }));
const orMock = mock((...args: unknown[]) => ({ type: 'or', args }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock, or: orMock }));

type ImageRow = { id: number } | undefined;

let mockImageRow: ImageRow = { id: 1 };
let mockR2Object: { body: ReadableStream; httpMetadata?: { contentType?: string } } | null = {
  body: new ReadableStream({
    start: (c) => {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.close();
    },
  }),
  httpMetadata: { contentType: 'image/jpeg' },
};

// 単一クエリ (select().from(images).innerJoin(posts).leftJoin(friendships).where()) を模す。
// visibility は SQL の where 側で判定される想定なので、mockImageRow の有無だけで「見える/見えない」を表現する。
// innerJoin(posts) により孤立画像 (images.postId IS NULL) も row なしとして表現される。
const imageWhereMock = mock(() => Promise.resolve(mockImageRow ? [mockImageRow] : []));
const friendshipsLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: imageWhereMock }));
const postsInnerJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: friendshipsLeftJoinMock }));

const selectMock = mock((_fields: unknown) => ({
  from: mock((_table: unknown) => ({
    innerJoin: postsInnerJoinMock,
  })),
}));

const mockR2Bucket: R2Bucket = {
  get: mock(async (_key: string) => mockR2Object),
} as unknown as R2Bucket;

const friendshipsTable = {
  id: 'friendships.id',
  requesterId: 'friendships.requesterId',
  addresseeId: 'friendships.addresseeId',
  status: 'friendships.status',
};

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({ select: selectMock }),
  images: { postId: 'images.postId', key: 'images.key' },
  posts: { id: 'posts.id', userId: 'posts.userId' },
  friendships: friendshipsTable,
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, { ...BINDINGS, IMAGES_BUCKET: mockR2Bucket });
}

describe('GET /api/images/:userId/:uuid', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockImageRow = { id: 1 };
    mockR2Object = {
      body: new ReadableStream({
        start: (c) => {
          c.enqueue(new Uint8Array([1, 2, 3]));
          c.close();
        },
      }),
      httpMetadata: { contentType: 'image/jpeg' },
    };
    eqMock.mockClear();
    andMock.mockClear();
    orMock.mockClear();
    selectMock.mockClear();
    postsInnerJoinMock.mockClear();
    friendshipsLeftJoinMock.mockClear();
    imageWhereMock.mockClear();
    (mockR2Bucket.get as ReturnType<typeof mock>).mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/images/user1/some-uuid');

    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('images レコードが存在しない場合は 404 を返す', async () => {
    mockImageRow = undefined;

    const res = await req('/api/images/user1/nonexistent-uuid');

    expect(res.status).toBe(404);
  });

  it('孤立画像（images.postId が null）は 404 を返す', async () => {
    // innerJoin(posts) により、対応する post を持たない画像は SQL レベルで row が返らない。
    mockImageRow = undefined;

    const res = await req('/api/images/user1/orphan-uuid');

    expect(res.status).toBe(404);
  });

  it('本人の画像は 200 と画像を返す', async () => {
    const res = await req('/api/images/user1/my-uuid');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('フレンドの画像は 200 を返す', async () => {
    // accepted friend の場合は SQL の where にマッチし row が返る想定。
    mockSessionValue = { user: { id: 'user2', name: 'Other User', email: 'other@example.com' } };
    mockImageRow = { id: 1 };

    const res = await req('/api/images/user1/friend-uuid');

    expect(res.status).toBe(200);
  });

  it('フレンドでない他人の画像は 404 を返す', async () => {
    // 非 friend の場合は SQL の where にマッチせず row が返らない想定。
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockImageRow = undefined;

    const res = await req('/api/images/user1/other-uuid');

    expect(res.status).toBe(404);
  });

  it('R2 にオブジェクトが存在しない場合は 404 を返す', async () => {
    mockR2Object = null;

    const res = await req('/api/images/user1/missing-uuid');

    expect(res.status).toBe(404);
  });

  it('不正な Content-Type は application/octet-stream にフォールバックする', async () => {
    mockR2Object = {
      body: new ReadableStream({
        start: (c) => {
          c.close();
        },
      }),
      httpMetadata: { contentType: 'text/html' },
    };

    const res = await req('/api/images/user1/my-uuid');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('visibility判定に friendships の JOIN と accepted 判定が使われている（isFriend()削除の回帰防止）', async () => {
    await req('/api/images/user1/my-uuid');

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
