import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

type PostRow = {
  id: number;
  pin: string;
  createdAt: Date;
  imageKey: string | null;
  shop: {
    id: number;
    googlePlaceId: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
};

let userResult: { id: string }[] = [{ id: 'user1' }];
let totalCount = 0;
let postRows: PostRow[] = [];
let selectCallCount = 0;
let mockDbError: Error | null = null;

const mockDb = {
  select: (_fields?: unknown) => {
    const callN = ++selectCallCount;

    if (callN === 1) {
      // user lookup: from(user).leftJoin(friendships).where()
      return {
        from: () => ({
          leftJoin: () => ({
            where: () => (mockDbError ? Promise.reject(mockDbError) : Promise.resolve(userResult)),
          }),
        }),
      };
    }
    if (callN === 2) {
      // count: from(posts).where()
      return {
        from: () => ({
          where: () => (mockDbError ? Promise.reject(mockDbError) : Promise.resolve([{ total: totalCount }])),
        }),
      };
    }
    // posts: from(posts).innerJoin(shops).leftJoin(images).where().orderBy().limit().offset()
    return {
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => (mockDbError ? Promise.reject(mockDbError) : Promise.resolve(postRows)),
                }),
              }),
            }),
          }),
        }),
      }),
    };
  },
};

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

const { default: app } = await import('../src/index');

const POST1: PostRow = {
  id: 1,
  pin: '🍜',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  imageKey: null,
  shop: {
    id: 10,
    googlePlaceId: 'place-old',
    name: 'Old Shop',
    address: null,
    lat: 35.68,
    lng: 139.76,
  },
};

const POST2: PostRow = {
  id: 2,
  pin: '🍣',
  createdAt: new Date('2026-01-03T00:00:00Z'),
  imageKey: 'user1/image-uuid',
  shop: {
    id: 20,
    googlePlaceId: 'place-new',
    name: 'New Shop',
    address: '東京都渋谷区1-2-3',
    lat: 35.69,
    lng: 139.77,
  },
};

function req(path: string) {
  return app.request(path, { method: 'GET' }, BINDINGS);
}

describe('GET /api/users/:handle/posts', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    userResult = [{ id: 'user1' }];
    totalCount = 0;
    postRows = [];
    selectCallCount = 0;
    mockDbError = null;
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await req('/api/users/myhandle/posts');
    expect(res.status).toBe(401);
  });

  it('存在しないハンドルは 404 を返す', async () => {
    userResult = [];
    const res = await req('/api/users/unknown/posts');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'User not found' });
  });

  it('友達でないユーザーは 404 を返す', async () => {
    userResult = [];
    const res = await req('/api/users/stranger/posts');
    expect(res.status).toBe(404);
  });

  it('自分のポストを取得できる', async () => {
    totalCount = 2;
    postRows = [POST2, POST1];
    const res = await req('/api/users/myhandle/posts');
    expect(res.status).toBe(200);
    const body = await res.json<{ posts: Array<{ id: number }>; nextPage: number | null }>();
    expect(body.posts.map((p) => p.id)).toEqual([2, 1]);
    expect(body.nextPage).toBeNull();
  });

  it('友達のポストを取得できる', async () => {
    userResult = [{ id: 'user2' }];
    totalCount = 1;
    postRows = [POST1];
    const res = await req('/api/users/friendhandle/posts');
    expect(res.status).toBe(200);
    const body = await res.json<{ posts: Array<{ id: number }>; nextPage: number | null }>();
    expect(body.posts.map((p) => p.id)).toEqual([1]);
  });

  it('画像あり投稿は imageUrl を返す', async () => {
    totalCount = 1;
    postRows = [POST2];
    const res = await req('/api/users/myhandle/posts');
    const body = await res.json<{ posts: Array<{ id: number; imageUrl: string | null }> }>();
    expect(body.posts[0]).toBeDefined();
    expect(body.posts[0]?.imageUrl).toBe('/api/images/user1/image-uuid');
  });

  it('画像なし投稿は imageUrl が null', async () => {
    totalCount = 1;
    postRows = [POST1];
    const res = await req('/api/users/myhandle/posts');
    const body = await res.json<{ posts: Array<{ id: number; imageUrl: string | null }> }>();
    expect(body.posts[0]).toBeDefined();
    expect(body.posts[0]?.imageUrl).toBeNull();
  });

  it('shop オブジェクトを含める', async () => {
    totalCount = 1;
    postRows = [POST2];
    const res = await req('/api/users/myhandle/posts');
    const body = await res.json<{ posts: Array<{ shop: unknown }> }>();
    expect(body.posts[0]).toBeDefined();
    expect(body.posts[0]?.shop).toEqual(POST2.shop);
  });

  it('投稿がない場合は空配列と nextPage: null を返す', async () => {
    totalCount = 0;
    postRows = [];
    const res = await req('/api/users/myhandle/posts');
    const body = await res.json<{ posts: unknown[]; nextPage: number | null }>();
    expect(res.status).toBe(200);
    expect(body.posts).toEqual([]);
    expect(body.nextPage).toBeNull();
  });

  it('次ページがある場合は nextPage に次のページ番号を返す', async () => {
    totalCount = 100;
    postRows = [POST1];
    const res = await req('/api/users/myhandle/posts?page=1&limit=1');
    const body = await res.json<{ nextPage: number | null }>();
    expect(res.status).toBe(200);
    expect(body.nextPage).toBe(2);
  });

  it('page が数値でないとき 400 を返す', async () => {
    const res = await req('/api/users/myhandle/posts?page=abc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'invalid page/limit' });
  });

  it('limit が数値でないとき 400 を返す', async () => {
    const res = await req('/api/users/myhandle/posts?limit=abc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'invalid page/limit' });
  });

  it('page が空文字のとき 400 を返す', async () => {
    const res = await req('/api/users/myhandle/posts?page=');
    expect(res.status).toBe(400);
  });

  it('limit が空文字のとき 400 を返す', async () => {
    const res = await req('/api/users/myhandle/posts?limit=');
    expect(res.status).toBe(400);
  });

  it('DB エラー時は 500 を返す', async () => {
    mockDbError = new Error('db error');
    const res = await req('/api/users/myhandle/posts');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
