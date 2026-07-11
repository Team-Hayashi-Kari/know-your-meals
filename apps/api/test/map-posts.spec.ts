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
const betweenMock = mock((column: unknown, min: unknown, max: unknown) => ({ type: 'between', column, min, max }));
const descMock = mock((column: unknown) => ({ type: 'desc', column }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, between: betweenMock, desc: descMock }));

type PinRow = {
  postId: number;
  pin: string;
  userId: string;
  lat: number;
  lng: number;
  shopName: string;
  imageKey: string | null;
  author: { id: string; handle: string | null; name: string; image: string | null };
};

let mockRows: PinRow[] = [
  {
    postId: 1,
    pin: '🍜',
    userId: 'user1',
    lat: 35.68,
    lng: 139.76,
    shopName: 'Test Shop',
    imageKey: 'user1/img1',
    author: { id: 'user1', handle: 'user1handle', name: 'Test User', image: null },
  },
];

const rowsLimitMock = mock((_n: unknown) => Promise.resolve(mockRows));
const rowsOrderByMock = mock((_col: unknown) => ({ limit: rowsLimitMock }));
const rowsWhereMock = mock(() => ({ orderBy: rowsOrderByMock }));
const friendshipsLeftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: rowsWhereMock }));
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
  posts: { id: 'posts.id', userId: 'posts.userId', shopId: 'posts.shopId', pin: 'posts.pin', comment: 'posts.comment', createdAt: 'posts.createdAt' },
  shops: { id: 'shops.id', lat: 'shops.lat', lng: 'shops.lng', name: 'shops.name' },
  images: { postId: 'images.postId', key: 'images.key' },
  friendships: friendshipsTable,
  user: { id: 'user.id', handle: 'user.handle', name: 'user.name', image: 'user.image' },
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/map/posts', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockRows = [
      {
        postId: 1,
        pin: '🍜',
        userId: 'user1',
        lat: 35.68,
        lng: 139.76,
        shopName: 'Test Shop',
        imageKey: 'user1/img1',
        author: { id: 'user1', handle: 'user1handle', name: 'Test User', image: null },
      },
    ];
    eqMock.mockClear();
    betweenMock.mockClear();
    descMock.mockClear();
    selectMock.mockClear();
    innerJoinMock.mockClear();
    userInnerJoinMock.mockClear();
    imagesLeftJoinMock.mockClear();
    friendshipsLeftJoinMock.mockClear();
    rowsWhereMock.mockClear();
    rowsOrderByMock.mockClear();
    rowsLimitMock.mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('bbox パラメータなしは 400 を返す', async () => {
    const res = await req('/api/map/posts');
    expect(res.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('bbox が3値のとき 400 を返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0');
    expect(res.status).toBe(400);
  });

  it('bbox に数値でない値が含まれるとき 400 を返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,abc,36.0,140.0');
    expect(res.status).toBe(400);
  });

  it('swLat > neLat のとき 400 を返す', async () => {
    const res = await req('/api/map/posts?bbox=36.0,139.0,35.0,140.0');
    expect(res.status).toBe(400);
  });

  it('swLng > neLng のとき 400 を返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,140.0,36.0,139.0');
    expect(res.status).toBe(400);
  });

  it('正常リクエストで 200 + pins 配列を返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: unknown[] };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.pins)).toBe(true);
    expect(body.pins).toHaveLength(1);
  });

  it('imageKey ありのとき imageUrl を /api/images/<key> で返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: { imageUrl: string | null }[] };

    expect(body.pins[0]?.imageUrl).toBe('/api/images/user1/img1');
  });

  it('imageKey なしのとき imageUrl: null を返す', async () => {
    mockRows = [{ ...(mockRows[0] as PinRow), imageKey: null }];
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: { imageUrl: string | null }[] };

    expect(body.pins[0]?.imageUrl).toBeNull();
  });

  it('結果0件のとき 200 + { pins: [] } を返す', async () => {
    mockRows = [];
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: unknown[] };

    expect(res.status).toBe(200);
    expect(body.pins).toHaveLength(0);
  });

  it('friendships の JOIN が実行されている（visibility 回帰防止）', async () => {
    await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');

    expect(friendshipsLeftJoinMock).toHaveBeenCalledTimes(1);
    expect(friendshipsLeftJoinMock.mock.calls[0]?.[0]).toBe(friendshipsTable);
    expect(eqMock).toHaveBeenCalledWith('friendships.requesterId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.addresseeId', 'user1');
    expect(eqMock).toHaveBeenCalledWith('friendships.status', 'accepted');
  });

  it('between が shops.lat と shops.lng に適用されている', async () => {
    await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');

    expect(betweenMock).toHaveBeenCalledWith('shops.lat', 35.0, 36.0);
    expect(betweenMock).toHaveBeenCalledWith('shops.lng', 139.0, 140.0);
  });

  it('レスポンスに postId, pin, userId, lat, lng, shopName が含まれる', async () => {
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: Record<string, unknown>[] };
    const pin = body.pins[0] as Record<string, unknown>;

    expect(pin).toHaveProperty('postId', 1);
    expect(pin).toHaveProperty('pin', '🍜');
    expect(pin).toHaveProperty('userId', 'user1');
    expect(pin).toHaveProperty('lat', 35.68);
    expect(pin).toHaveProperty('lng', 139.76);
    expect(pin).toHaveProperty('shopName', 'Test Shop');
  });

  it('bbox にカンマだけのセグメント（空文字）があると 400 を返す', async () => {
    const res = await req('/api/map/posts?bbox=35.0,,36.0,140.0');
    expect(res.status).toBe(400);
  });

  it('orderBy(desc(posts.createdAt)) が呼ばれている', async () => {
    await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    expect(rowsOrderByMock).toHaveBeenCalledTimes(1);
    expect(descMock).toHaveBeenCalledWith('posts.createdAt');
  });

  it('limit(MAX_PINS) が呼ばれている', async () => {
    await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    expect(rowsLimitMock).toHaveBeenCalledTimes(1);
    expect(rowsLimitMock.mock.calls[0]?.[0]).toBe(50);
  });

  it('レスポンスに imageKey は含まれない', async () => {
    const res = await req('/api/map/posts?bbox=35.0,139.0,36.0,140.0');
    const body = (await res.json()) as { pins: Record<string, unknown>[] };

    expect(body.pins[0]).not.toHaveProperty('imageKey');
  });
});
