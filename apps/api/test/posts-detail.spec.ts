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
      shop: {
        id: number;
        googlePlaceId: string;
        name: string;
        address: string | null;
        lat: number;
        lng: number;
      };
    }
  | undefined;

type FriendRow = { id: number } | undefined;

let mockPostRow: PostRow = {
  id: 1,
  userId: 'user1',
  comment: 'test comment',
  pin: '🍜',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T01:00:00Z'),
  imageKey: 'user1/some-uuid',
  shop: {
    id: 10,
    googlePlaceId: 'place-1',
    name: 'Test Shop',
    address: '東京都渋谷区1-2-3',
    lat: 35.68,
    lng: 139.76,
  },
};
let mockFriendRow: FriendRow;

const limitMock = mock(() => Promise.resolve(mockFriendRow ? [mockFriendRow] : []));
const friendWhereMock = mock(() => ({ limit: limitMock }));
const postWhereMock = mock(() => Promise.resolve(mockPostRow ? [mockPostRow] : []));
const leftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: postWhereMock }));
const innerJoinMock = mock((_table: unknown, _condition: unknown) => ({ leftJoin: leftJoinMock }));

const selectMock = mock((_fields: unknown) => ({
  from: mock((_table: unknown) => ({
    innerJoin: innerJoinMock,
    where: friendWhereMock,
  })),
}));

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
  friendships: { id: 'friendships.id', requesterId: 'friendships.requesterId', addresseeId: 'friendships.addresseeId', status: 'friendships.status' },
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
      shop: { id: 10, googlePlaceId: 'place-1', name: 'Test Shop', address: '東京都渋谷区1-2-3', lat: 35.68, lng: 139.76 },
    };
    mockFriendRow = undefined;
    eqMock.mockClear();
    selectMock.mockClear();
    innerJoinMock.mockClear();
    leftJoinMock.mockClear();
    postWhereMock.mockClear();
    friendWhereMock.mockClear();
    limitMock.mockClear();
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
    mockSessionValue = { user: { id: 'user2', name: 'Friend', email: 'friend@example.com' } };
    mockPostRow = { ...(mockPostRow as NonNullable<PostRow>), userId: 'user1' };
    mockFriendRow = { id: 99 };

    const res = await req('/api/posts/1');

    expect(res.status).toBe(200);
  });

  it('他人の投稿は 404 を返す', async () => {
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockPostRow = { ...(mockPostRow as NonNullable<PostRow>), userId: 'user1' };
    mockFriendRow = undefined;

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
});
