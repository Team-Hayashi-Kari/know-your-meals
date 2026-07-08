import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const FRIEND_FROM_ADDRESSEE = {
  requesterId: 'user1',
  requester: {
    id: 'user1',
    handle: 'me',
    name: 'Test User',
    image: null,
    bio: null,
    email: 'test@example.com',
  },
  addressee: {
    id: 'user2',
    handle: 'friend-a',
    name: 'Friend A',
    image: 'https://example.com/friend-a.png',
    bio: 'ramen',
    email: 'friend-a@example.com',
  },
};

const FRIEND_FROM_REQUESTER = {
  requesterId: 'user3',
  requester: {
    id: 'user3',
    handle: 'friend-b',
    name: 'Friend B',
    image: null,
    bio: 'sushi',
    email: 'friend-b@example.com',
  },
  addressee: {
    id: 'user1',
    handle: 'me',
    name: 'Test User',
    image: null,
    bio: null,
    email: 'test@example.com',
  },
};

let mockSelectResult: unknown[] = [];
let mockSelectError: Error | null = null;

const userColumns = {
  id: 'user.id',
  name: 'user.name',
  email: 'user.email',
  image: 'user.image',
  handle: 'user.handle',
  bio: 'user.bio',
  createdAt: 'user.createdAt',
  updatedAt: 'user.updatedAt',
};

const friendshipColumns = {
  requesterId: 'friendships.requesterId',
  addresseeId: 'friendships.addresseeId',
  status: 'friendships.status',
  createdAt: 'friendships.createdAt',
  updatedAt: 'friendships.updatedAt',
};

const actualDrizzleOrm = await import('drizzle-orm');
const eqMock = mock(actualDrizzleOrm.eq);
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock }));

mock.module('@repo/db', () => {
  return {
    createDb: () => ({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: async () => {
                  if (mockSelectError) throw mockSelectError;
                  return mockSelectResult;
                },
              }),
            }),
          }),
        }),
      }),
    }),
    friendships: friendshipColumns,
    user: userColumns,
  };
});

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me/friends', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockSelectResult = [];
    mockSelectError = null;
    eqMock.mockClear();
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/me/friends');
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('accepted friendship がない場合 200 [] を返す', async () => {
    const res = await req('/api/me/friends');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('自分が requesterId の accepted friendship では addressee 側のユーザーを返す', async () => {
    mockSelectResult = [FRIEND_FROM_ADDRESSEE];

    const res = await req('/api/me/friends');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      {
        id: 'user2',
        handle: 'friend-a',
        name: 'Friend A',
        image: 'https://example.com/friend-a.png',
        bio: 'ramen',
      },
    ]);
  });

  it('自分が addresseeId の accepted friendship では requester 側のユーザーを返す', async () => {
    mockSelectResult = [FRIEND_FROM_REQUESTER];

    const res = await req('/api/me/friends');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      {
        id: 'user3',
        handle: 'friend-b',
        name: 'Friend B',
        image: null,
        bio: 'sushi',
      },
    ]);
  });

  it('accepted friendship のみ取得する条件で DB 問い合わせする', async () => {
    const res = await req('/api/me/friends');

    expect(res.status).toBe(200);
    expect(eqMock).toHaveBeenCalledWith(friendshipColumns.status, 'accepted');
  });

  it('自分自身の user 情報は返さない', async () => {
    mockSelectResult = [
      {
        requesterId: 'user1',
        requester: {
          id: 'user1',
          handle: 'me',
          name: 'Test User',
          image: null,
          bio: null,
        },
        addressee: {
          id: 'user1',
          handle: 'me',
          name: 'Test User',
          image: null,
          bio: null,
        },
      },
    ];

    const res = await req('/api/me/friends');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('レスポンスに email を含めない', async () => {
    mockSelectResult = [FRIEND_FROM_ADDRESSEE, FRIEND_FROM_REQUESTER];

    const res = await req('/api/me/friends');
    const body = (await res.json()) as Record<string, unknown>[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty('email');
    expect(body[1]).not.toHaveProperty('email');
  });

  it('DB 問い合わせに失敗した場合 500 を返す', async () => {
    mockSelectError = new Error('db error');

    const res = await req('/api/me/friends');
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
