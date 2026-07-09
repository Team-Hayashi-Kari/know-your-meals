import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

type Condition = { type: 'eq'; column: unknown; value: unknown } | { type: 'and' | 'or'; conditions: Condition[] };

const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock((column: unknown, value: unknown): Condition => ({ type: 'eq', column, value }));
const andMock = mock((...conditions: Condition[]): Condition => ({ type: 'and', conditions }));
const orMock = mock((...conditions: Condition[]): Condition => ({ type: 'or', conditions }));
const descMock = mock((column: unknown) => ({ type: 'desc', column }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock, or: orMock, desc: descMock }));

function findEqValue(condition: Condition | undefined, columnName: unknown): unknown {
  if (!condition) return undefined;
  if (condition.type === 'eq') return condition.column === columnName ? condition.value : undefined;
  for (const c of condition.conditions) {
    const value = findEqValue(c, columnName);
    if (value !== undefined) return value;
  }
  return undefined;
}

type BookmarkRow = {
  bookmarkId: number;
  bookmarkUserId: string;
  bookmarkCreatedAt: Date;
  postId: number;
  postUserId: string;
  friendshipStatus: 'pending' | 'accepted' | 'denied' | null;
  comment: string | null;
  pin: string;
  postCreatedAt: Date;
  postUpdatedAt: Date;
  imageKey: string | null;
  shop: { id: number; googlePlaceId: string; name: string; address: string | null; lat: number; lng: number };
  author: { id: string; handle: string | null; name: string | null; image: string | null };
};

const OWN_POST: BookmarkRow = {
  bookmarkId: 1,
  bookmarkUserId: 'user1',
  bookmarkCreatedAt: new Date('2026-01-05T00:00:00Z'),
  postId: 101,
  postUserId: 'user1',
  friendshipStatus: null,
  comment: 'my post',
  pin: '🍜',
  postCreatedAt: new Date('2026-01-01T00:00:00Z'),
  postUpdatedAt: new Date('2026-01-01T01:00:00Z'),
  imageKey: null,
  shop: { id: 10, googlePlaceId: 'place-own', name: 'Own Shop', address: null, lat: 35.68, lng: 139.76 },
  author: { id: 'user1', handle: 'user1handle', name: 'Test User', image: null },
};

const ACCEPTED_FRIEND_POST: BookmarkRow = {
  bookmarkId: 2,
  bookmarkUserId: 'user1',
  bookmarkCreatedAt: new Date('2026-01-04T00:00:00Z'),
  postId: 102,
  postUserId: 'user2',
  friendshipStatus: 'accepted',
  comment: 'friend post',
  pin: '🍣',
  postCreatedAt: new Date('2026-01-02T00:00:00Z'),
  postUpdatedAt: new Date('2026-01-02T01:00:00Z'),
  imageKey: 'user2/image-uuid',
  shop: { id: 20, googlePlaceId: 'place-friend', name: 'Friend Shop', address: '東京都渋谷区1-2-3', lat: 35.69, lng: 139.77 },
  author: { id: 'user2', handle: 'user2handle', name: 'Friend User', image: 'https://example.com/user2.png' },
};

const PENDING_FRIEND_POST: BookmarkRow = {
  ...ACCEPTED_FRIEND_POST,
  bookmarkId: 3,
  bookmarkCreatedAt: new Date('2026-01-03T00:00:00Z'),
  postId: 103,
  postUserId: 'user3',
  friendshipStatus: 'pending',
};

const DENIED_FRIEND_POST: BookmarkRow = {
  ...ACCEPTED_FRIEND_POST,
  bookmarkId: 4,
  bookmarkCreatedAt: new Date('2026-01-02T00:00:00Z'),
  postId: 104,
  postUserId: 'user4',
  friendshipStatus: 'denied',
};

const STRANGER_POST: BookmarkRow = {
  ...ACCEPTED_FRIEND_POST,
  bookmarkId: 5,
  bookmarkCreatedAt: new Date('2026-01-01T00:00:00Z'),
  postId: 105,
  postUserId: 'user5',
  friendshipStatus: null,
};

const OTHER_USERS_BOOKMARK: BookmarkRow = {
  ...OWN_POST,
  bookmarkId: 6,
  bookmarkUserId: 'user2',
  bookmarkCreatedAt: new Date('2026-01-06T00:00:00Z'),
  postId: 106,
};

let mockBookmarkRows: BookmarkRow[] = [OWN_POST, ACCEPTED_FRIEND_POST, PENDING_FRIEND_POST, DENIED_FRIEND_POST, STRANGER_POST, OTHER_USERS_BOOKMARK];
let mockSelectError: Error | null = null;

const innerJoinMock = mock((_table: unknown, _condition: unknown) => queryBuilder);
const leftJoinMock = mock((_table: unknown, _condition: unknown) => queryBuilder);
const whereMock = mock((condition: Condition) => ({ orderBy: orderByMock, condition }));
const orderByMock = mock((_order: unknown) => {
  if (mockSelectError) throw mockSelectError;
  const condition = whereMock.mock.calls.at(-1)?.[0];
  const authUserId = findEqValue(condition, 'bookmarks.userId');
  return Promise.resolve(
    mockBookmarkRows
      .filter((row) => row.bookmarkUserId === authUserId && (row.postUserId === authUserId || row.friendshipStatus === 'accepted'))
      .sort((a, b) => b.bookmarkCreatedAt.getTime() - a.bookmarkCreatedAt.getTime())
      .map((row) => ({
        id: row.postId,
        comment: row.comment,
        pin: row.pin,
        createdAt: row.postCreatedAt,
        updatedAt: row.postUpdatedAt,
        imageKey: row.imageKey,
        shop: row.shop,
        author: row.author,
      })),
  );
});

const queryBuilder = {
  innerJoin: innerJoinMock,
  leftJoin: leftJoinMock,
  where: whereMock,
};

const selectMock = mock((_fields: unknown) => ({
  from: mock((_table: unknown) => queryBuilder),
}));

mock.module('@repo/db', () => ({
  createDb: () => ({ select: selectMock }),
  user: {
    id: 'user.id',
    name: 'user.name',
    email: 'user.email',
    image: 'user.image',
    handle: 'user.handle',
    bio: 'user.bio',
    createdAt: 'user.createdAt',
    updatedAt: 'user.updatedAt',
  },
  posts: {
    id: 'posts.id',
    userId: 'posts.userId',
    shopId: 'posts.shopId',
    comment: 'posts.comment',
    pin: 'posts.pin',
    createdAt: 'posts.createdAt',
    updatedAt: 'posts.updatedAt',
  },
  shops: {
    id: 'shops.id',
    googlePlaceId: 'shops.googlePlaceId',
    name: 'shops.name',
    address: 'shops.address',
    lat: 'shops.lat',
    lng: 'shops.lng',
  },
  images: {
    postId: 'images.postId',
    key: 'images.key',
  },
  bookmarks: {
    id: 'bookmarks.id',
    userId: 'bookmarks.userId',
    postId: 'bookmarks.postId',
    createdAt: 'bookmarks.createdAt',
  },
  friendships: {
    id: 'friendships.id',
    requesterId: 'friendships.requesterId',
    addresseeId: 'friendships.addresseeId',
    status: 'friendships.status',
  },
  pinEmojiEnum: { enumValues: ['🍜', '🍣', '🍛', '🍙', '🍔', '🍕', '🥩', '🍰', '🍺', '🥟'] },
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me/bookmarks', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockBookmarkRows = [OWN_POST, ACCEPTED_FRIEND_POST, PENDING_FRIEND_POST, DENIED_FRIEND_POST, STRANGER_POST, OTHER_USERS_BOOKMARK];
    mockSelectError = null;
    eqMock.mockClear();
    andMock.mockClear();
    orMock.mockClear();
    descMock.mockClear();
    selectMock.mockClear();
    innerJoinMock.mockClear();
    leftJoinMock.mockClear();
    whereMock.mockClear();
    orderByMock.mockClear();
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/me/bookmarks');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('ログイン済みだと 200 と保存投稿配列を返す', async () => {
    const res = await req('/api/me/bookmarks');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeArray();
  });

  it('自分の bookmark に紐づく投稿だけ返す（他人の bookmark は除外）', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number }>;

    expect(body).not.toContainEqual(expect.objectContaining({ id: 106 }));
  });

  it('bookmarks.createdAt desc（保存した順）で返す', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number }>;

    expect(body.map((post) => post.id)).toEqual([101, 102]);
  });

  it('自分の投稿は返す', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number }>;

    expect(body).toContainEqual(expect.objectContaining({ id: 101 }));
  });

  it('accepted friend の投稿は返す', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number }>;

    expect(body).toContainEqual(expect.objectContaining({ id: 102 }));
  });

  it('pending / denied / 非 friend の投稿は返さない', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number }>;
    const ids = body.map((post) => post.id);

    expect(ids).not.toContain(103);
    expect(ids).not.toContain(104);
    expect(ids).not.toContain(105);
  });

  it('imageUrl が /api/images/<key> または null になる', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number; imageUrl: string | null }>;

    expect(body.find((post) => post.id === 101)).toHaveProperty('imageUrl', null);
    expect(body.find((post) => post.id === 102)).toHaveProperty('imageUrl', '/api/images/user2/image-uuid');
  });

  it('shop オブジェクトを含める', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number; shop: unknown }>;

    expect(body.find((post) => post.id === 102)?.shop).toEqual({
      id: 20,
      googlePlaceId: 'place-friend',
      name: 'Friend Shop',
      address: '東京都渋谷区1-2-3',
      lat: 35.69,
      lng: 139.77,
    });
  });

  it('author オブジェクトを含める', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<{ id: number; author: unknown }>;

    expect(body.find((post) => post.id === 102)?.author).toEqual({
      id: 'user2',
      handle: 'user2handle',
      name: 'Friend User',
      image: 'https://example.com/user2.png',
    });
  });

  it('bookmark が無い場合は 200 と空配列を返す', async () => {
    mockBookmarkRows = [OTHER_USERS_BOOKMARK, PENDING_FRIEND_POST];

    const res = await req('/api/me/bookmarks');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('DB 問い合わせに失敗した場合 500 を返す', async () => {
    mockSelectError = new Error('db error');

    const res = await req('/api/me/bookmarks');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('bookmarkId / bookmarkedAt を含めない', async () => {
    const res = await req('/api/me/bookmarks');
    const body = (await res.json()) as Array<Record<string, unknown>>;

    for (const post of body) {
      expect(post).not.toHaveProperty('bookmarkId');
      expect(post).not.toHaveProperty('bookmarkedAt');
    }
  });
});
