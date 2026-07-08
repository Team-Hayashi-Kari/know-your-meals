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
const descMock = mock((column: unknown) => ({ type: 'desc', column }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, desc: descMock }));

type PostRow = {
  id: number;
  comment: string | null;
  pin: string;
  createdAt: Date;
  updatedAt: Date;
  imageKey: string | null;
  userId: string;
  shop: {
    id: number;
    googlePlaceId: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
};

const USER1_OLD_POST: PostRow = {
  id: 1,
  comment: 'old post',
  pin: '🍜',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T01:00:00Z'),
  imageKey: null,
  userId: 'user1',
  shop: {
    id: 10,
    googlePlaceId: 'place-old',
    name: 'Old Shop',
    address: null,
    lat: 35.68,
    lng: 139.76,
  },
};

const USER1_NEW_POST: PostRow = {
  id: 2,
  comment: null,
  pin: '🍣',
  createdAt: new Date('2026-01-03T00:00:00Z'),
  updatedAt: new Date('2026-01-03T01:00:00Z'),
  imageKey: 'user1/image-uuid',
  userId: 'user1',
  shop: {
    id: 20,
    googlePlaceId: 'place-new',
    name: 'New Shop',
    address: '東京都渋谷区1-2-3',
    lat: 35.69,
    lng: 139.77,
  },
};

const OTHER_USER_POST: PostRow = {
  id: 3,
  comment: 'other user post',
  pin: '🍛',
  createdAt: new Date('2026-01-04T00:00:00Z'),
  updatedAt: new Date('2026-01-04T01:00:00Z'),
  imageKey: 'user2/image-uuid',
  userId: 'user2',
  shop: {
    id: 30,
    googlePlaceId: 'place-other',
    name: 'Other Shop',
    address: '東京都新宿区1-2-3',
    lat: 35.7,
    lng: 139.78,
  },
};

let mockPostRows: PostRow[] = [USER1_OLD_POST, OTHER_USER_POST, USER1_NEW_POST];
let mockSelectError: Error | null = null;
const innerJoinMock = mock((_table: unknown, _condition: unknown) => queryBuilder);
const leftJoinMock = mock((_table: unknown, _condition: unknown) => queryBuilder);
const whereMock = mock((condition: { column?: unknown; value?: unknown }) => ({
  orderBy: orderByMock,
  condition,
}));
const orderByMock = mock((_order: { column?: unknown }) => {
  if (mockSelectError) throw mockSelectError;
  const userId = whereMock.mock.calls.at(-1)?.[0]?.value;
  return Promise.resolve(
    mockPostRows
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ userId: _userId, ...row }) => row),
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
  friendships: {
    id: 'friendships.id',
    requesterId: 'friendships.requesterId',
    addresseeId: 'friendships.addresseeId',
  },
}));

const { default: app } = await import('../src/index');


function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me/posts', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockPostRows = [USER1_OLD_POST, OTHER_USER_POST, USER1_NEW_POST];
    mockSelectError = null;
    eqMock.mockClear();
    descMock.mockClear();
    selectMock.mockClear();
    innerJoinMock.mockClear();
    leftJoinMock.mockClear();
    whereMock.mockClear();
    orderByMock.mockClear();
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/me/posts');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('ログイン済みだと 200 と本人の投稿配列を新しい順で返す', async () => {
    const res = await req('/api/me/posts');
    const body = (await res.json()) as Array<{ id: number; imageUrl: string | null; shop: unknown }>;

    expect(res.status).toBe(200);
    expect(body).toBeArray();
    expect(body.map((post) => post.id)).toEqual([2, 1]);
    expect(body).not.toContainEqual(expect.objectContaining({ id: 3 }));
  });

  it('画像あり投稿では imageUrl を /api/images/<key> で返す', async () => {
    const res = await req('/api/me/posts');
    const body = (await res.json()) as Array<{ id: number; imageUrl: string | null }>;

    expect(body.find((post) => post.id === 2)).toHaveProperty('imageUrl', '/api/images/user1/image-uuid');
  });

  it('画像なし投稿では imageUrl: null を返す', async () => {
    const res = await req('/api/me/posts');
    const body = (await res.json()) as Array<{ id: number; imageUrl: string | null }>;

    expect(body.find((post) => post.id === 1)).toHaveProperty('imageUrl', null);
  });

  it('shop オブジェクトを含める', async () => {
    const res = await req('/api/me/posts');
    const body = (await res.json()) as Array<{ id: number; shop: unknown }>;

    expect(body.find((post) => post.id === 2)?.shop).toEqual({
      id: 20,
      googlePlaceId: 'place-new',
      name: 'New Shop',
      address: '東京都渋谷区1-2-3',
      lat: 35.69,
      lng: 139.77,
    });
  });

  it('投稿がない場合は 200 と空配列を返す', async () => {
    mockPostRows = [OTHER_USER_POST];

    const res = await req('/api/me/posts');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('DB 問い合わせに失敗した場合 500 を返す', async () => {
    mockSelectError = new Error('db error');

    const res = await req('/api/me/posts');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
