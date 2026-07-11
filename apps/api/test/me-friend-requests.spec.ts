import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const REQUEST_FROM_USER2 = {
  requester: {
    id: 'user2',
    handle: 'friend-a',
    name: 'Friend A',
    image: 'https://example.com/friend-a.png',
    bio: 'ramen',
    email: 'friend-a@example.com',
  },
};

const REQUEST_FROM_USER3 = {
  requester: {
    id: 'user3',
    handle: 'friend-b',
    name: 'Friend B',
    image: null,
    bio: 'sushi',
    email: 'friend-b@example.com',
  },
};

const REQUEST_TO_USER4 = {
  friendshipId: 10,
  requestedAt: '2026-07-01T00:00:00.000Z',
  addressee: {
    id: 'user4',
    handle: 'friend-c',
    name: 'Friend C',
    image: 'https://example.com/friend-c.png',
    bio: 'curry',
    email: 'friend-c@example.com',
  },
};

const REQUEST_TO_USER5 = {
  friendshipId: 11,
  requestedAt: '2026-06-25T00:00:00.000Z',
  addressee: {
    id: 'user5',
    handle: 'friend-d',
    name: 'Friend D',
    image: null,
    bio: 'soba',
    email: 'friend-d@example.com',
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

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => {
  return {
    ...actualDb,
    createDb: () => ({
      select: () => ({
        from: () => ({
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
    friendships: friendshipColumns,
    user: userColumns,
  };
});

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me/friend-requests', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockSelectResult = [];
    mockSelectError = null;
    eqMock.mockClear();
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/me/friend-requests?direction=received');
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('direction を省略すると 400 を返す', async () => {
    const res = await req('/api/me/friend-requests');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid direction' });
  });

  it('direction=recieved (typo) は 400 を返す', async () => {
    const res = await req('/api/me/friend-requests?direction=recieved');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid direction' });
  });

  describe('direction=received', () => {
    it('pending の受信申請がない場合 200 [] を返す', async () => {
      const res = await req('/api/me/friend-requests?direction=received');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it('pending の受信申請を requester 側のユーザーで返す', async () => {
      mockSelectResult = [REQUEST_FROM_USER2, REQUEST_FROM_USER3];

      const res = await req('/api/me/friend-requests?direction=received');
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
        {
          id: 'user3',
          handle: 'friend-b',
          name: 'Friend B',
          image: null,
          bio: 'sushi',
        },
      ]);
    });

    it('レスポンスに email を含めない', async () => {
      mockSelectResult = [REQUEST_FROM_USER2];

      const res = await req('/api/me/friend-requests?direction=received');
      const body = (await res.json()) as Record<string, unknown>[];

      expect(res.status).toBe(200);
      expect(body[0]).not.toHaveProperty('email');
    });

    it('status = pending の条件で DB 問い合わせする', async () => {
      const res = await req('/api/me/friend-requests?direction=received');

      expect(res.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith(friendshipColumns.status, 'pending');
    });

    it('addresseeId = 自分 の条件で DB 問い合わせする', async () => {
      const res = await req('/api/me/friend-requests?direction=received');

      expect(res.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith(friendshipColumns.addresseeId, 'user1');
    });

    it('DB 問い合わせに失敗した場合 500 を返す', async () => {
      mockSelectError = new Error('db error');

      const res = await req('/api/me/friend-requests?direction=received');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('direction=sent', () => {
    it('pending の送信申請がない場合 200 [] を返す', async () => {
      const res = await req('/api/me/friend-requests?direction=sent');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it('pending の送信申請を addressee 側のユーザーで返す', async () => {
      mockSelectResult = [REQUEST_TO_USER4, REQUEST_TO_USER5];

      const res = await req('/api/me/friend-requests?direction=sent');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([
        {
          friendshipId: 10,
          requestedAt: '2026-07-01T00:00:00.000Z',
          id: 'user4',
          handle: 'friend-c',
          name: 'Friend C',
          image: 'https://example.com/friend-c.png',
          bio: 'curry',
        },
        {
          friendshipId: 11,
          requestedAt: '2026-06-25T00:00:00.000Z',
          id: 'user5',
          handle: 'friend-d',
          name: 'Friend D',
          image: null,
          bio: 'soba',
        },
      ]);
    });

    it('レスポンスに email を含めない', async () => {
      mockSelectResult = [REQUEST_TO_USER4];

      const res = await req('/api/me/friend-requests?direction=sent');
      const body = (await res.json()) as Record<string, unknown>[];

      expect(res.status).toBe(200);
      expect(body[0]).not.toHaveProperty('email');
    });

    it('status = pending の条件で DB 問い合わせする', async () => {
      const res = await req('/api/me/friend-requests?direction=sent');

      expect(res.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith(friendshipColumns.status, 'pending');
    });

    it('requesterId = 自分 の条件で DB 問い合わせする', async () => {
      const res = await req('/api/me/friend-requests?direction=sent');

      expect(res.status).toBe(200);
      expect(eqMock).toHaveBeenCalledWith(friendshipColumns.requesterId, 'user1');
    });

    it('DB 問い合わせに失敗した場合 500 を返す', async () => {
      mockSelectError = new Error('db error');

      const res = await req('/api/me/friend-requests?direction=sent');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});
