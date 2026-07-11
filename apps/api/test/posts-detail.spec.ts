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

type PostRow =
  | {
      id: number;
      userId: string;
      comment: string | null;
      pin: string;
      createdAt: Date;
      updatedAt: Date;
      imageKey: string | null;
      bookmarkId: number | null;
      shop: {
        id: number;
        googlePlaceId: string;
        name: string;
        address: string | null;
        lat: number;
        lng: number;
      };
      author: { id: string; handle: string | null; name: string; image: string | null };
    }
  | undefined;

let mockPostRow: PostRow = {
  id: 1,
  userId: 'user1',
  comment: 'test comment',
  pin: '🍜',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T01:00:00Z'),
  imageKey: 'user1/some-uuid',
  bookmarkId: null,
  shop: {
    id: 10,
    googlePlaceId: 'place-1',
    name: 'Test Shop',
    address: '東京都渋谷区1-2-3',
    lat: 35.68,
    lng: 139.76,
  },
  author: { id: 'user1', handle: 'user1handle', name: 'Test User', image: null },
};

// 単一クエリ (select().from(posts).innerJoin(shops).innerJoin(user).leftJoin(images).leftJoin(friendships).leftJoin(bookmarks).where()) を模す。
// visibility は SQL の where 側で判定される想定なので、mockPostRow の有無だけで「見える/見えない」を表現する。
const postWhereMock = mock(() => Promise.resolve(mockPostRow ? [mockPostRow] : []));
const bookmarksLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: postWhereMock }));
const friendshipsLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: bookmarksLeftJoinMock }));
const imagesLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: friendshipsLeftJoinMock }));
const userInnerJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: imagesLeftJoinMock }));
const innerJoinMock = mock((_table: unknown, _condition: unknown) => ({ innerJoin: userInnerJoinMock }));

const selectMock = mock((_fields: unknown) => ({
  from: mock((_table: unknown) => ({
    innerJoin: innerJoinMock,
  })),
}));

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
  posts: {
    id: 'posts.id',
    userId: 'posts.userId',
    comment: 'posts.comment',
    pin: 'posts.pin',
    createdAt: 'posts.createdAt',
    updatedAt: 'posts.updatedAt',
    shopId: 'posts.shopId',
  },
  shops: { id: 'shops.id', googlePlaceId: 'shops.googlePlaceId', name: 'shops.name', address: 'shops.address', lat: 'shops.lat', lng: 'shops.lng' },
  images: { postId: 'images.postId', key: 'images.key' },
  friendships: friendshipsTable,
  bookmarks: { id: 'bookmarks.id', postId: 'bookmarks.postId', userId: 'bookmarks.userId' },
  user: { id: 'user.id', handle: 'user.handle', name: 'user.name', image: 'user.image' },
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/posts/:id', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockPostRow = {
      id: 1,
      userId: 'user1',
      comment: 'test comment',
      pin: '🍜',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T01:00:00Z'),
      imageKey: 'user1/some-uuid',
      bookmarkId: null,
      shop: { id: 10, googlePlaceId: 'place-1', name: 'Test Shop', address: '東京都渋谷区1-2-3', lat: 35.68, lng: 139.76 },
      author: { id: 'user1', handle: 'user1handle', name: 'Test User', image: null },
    };
    eqMock.mockClear();
    selectMock.mockClear();
    innerJoinMock.mockClear();
    userInnerJoinMock.mockClear();
    imagesLeftJoinMock.mockClear();
    friendshipsLeftJoinMock.mockClear();
    bookmarksLeftJoinMock.mockClear();
    postWhereMock.mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/posts/1');

    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('idが数値でない場合は 400 を返す', async () => {
    const res = await req('/api/posts/abc');

    expect(res.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('存在しない投稿は 404 を返す', async () => {
    mockPostRow = undefined;

    const res = await req('/api/posts/999');

    expect(res.status).toBe(404);
  });

  it('本人の投稿は 200 を返す', async () => {
    const res = await req('/api/posts/1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: 1, userId: 'user1', pin: '🍜' });
  });

  it('フレンドの投稿は 200 を返す', async () => {
    // visibility は SQL の where (posts.userId = viewer OR friendships.status = 'accepted') 側で判定される。
    // accepted friend の場合はクエリが row を返す想定なので、mockPostRow をそのまま残す。
    mockSessionValue = { user: { id: 'user2', name: 'Friend', email: 'friend@example.com' } };
    mockPostRow = { ...(mockPostRow as NonNullable<PostRow>), userId: 'user1' };

    const res = await req('/api/posts/1');

    expect(res.status).toBe(200);
  });

  it('他人の投稿は 404 を返す', async () => {
    // 非 friend の場合は SQL の where にマッチせず row が返らない想定。
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockPostRow = undefined;

    const res = await req('/api/posts/1');

    expect(res.status).toBe(404);
  });

  it('画像あり投稿では imageUrl を /api/images/<key> で返す', async () => {
    const res = await req('/api/posts/1');
    const body = (await res.json()) as { imageUrl: string | null };

    expect(body.imageUrl).toBe('/api/images/user1/some-uuid');
  });

  it('画像なし投稿では imageUrl: null を返す', async () => {
    mockPostRow = { ...(mockPostRow as NonNullable<PostRow>), imageKey: null };

    const res = await req('/api/posts/1');
    const body = (await res.json()) as { imageUrl: string | null };

    expect(body.imageUrl).toBeNull();
  });

  it('shop オブジェクトを含める', async () => {
    const res = await req('/api/posts/1');
    const body = (await res.json()) as { shop: unknown };

    expect(body.shop).toEqual({ id: 10, googlePlaceId: 'place-1', name: 'Test Shop', address: '東京都渋谷区1-2-3', lat: 35.68, lng: 139.76 });
  });

  it('visibility判定に friendships の JOIN と accepted 判定が使われている（isFriend()削除の回帰防止）', async () => {
    await req('/api/posts/1');

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

  it('bookmark 済みの投稿では isBookmarked: true を返す', async () => {
    mockPostRow = { ...(mockPostRow as NonNullable<PostRow>), bookmarkId: 5 };

    const res = await req('/api/posts/1');
    const body = (await res.json()) as { isBookmarked: boolean };

    expect(res.status).toBe(200);
    expect(body.isBookmarked).toBe(true);
  });

  it('bookmark していない投稿では isBookmarked: false を返す', async () => {
    const res = await req('/api/posts/1');
    const body = (await res.json()) as { isBookmarked: boolean };

    expect(res.status).toBe(200);
    expect(body.isBookmarked).toBe(false);
  });

  it('見えない投稿は 404 のままで bookmark 状態は漏れない', async () => {
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockPostRow = undefined;

    const res = await req('/api/posts/1');
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).not.toHaveProperty('isBookmarked');
  });

  it('leftJoin(bookmarks, ...) が userId/postId 条件で実行されている', async () => {
    await req('/api/posts/1');

    expect(bookmarksLeftJoinMock).toHaveBeenCalledTimes(1);
    expect(bookmarksLeftJoinMock.mock.calls[0]?.[0]).toEqual({ id: 'bookmarks.id', postId: 'bookmarks.postId', userId: 'bookmarks.userId' });
    expect(eqMock).toHaveBeenCalledWith('bookmarks.postId', 'posts.id');
    expect(eqMock).toHaveBeenCalledWith('bookmarks.userId', 'user1');
  });
});
