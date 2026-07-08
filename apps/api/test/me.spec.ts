import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Env } from '../src/types';

// `getSession` の戻り値を各テストで切り替える
let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const MOCK_USER_ROW = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  handle: null,
  bio: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

let mockSelectResult: unknown[] = [MOCK_USER_ROW];

mock.module('@repo/db', () => ({
  createDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => mockSelectResult,
      }),
    }),
  }),
  user: {
    id: 'id',
    name: 'name',
    email: 'email',
    image: 'image',
    handle: 'handle',
    bio: 'bio',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

const { default: app } = await import('../src/index');

const BINDINGS: Env['Bindings'] = {
  DATABASE_URL: 'postgres://test',
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_PLACES_API_KEY: 'test-api-key',
};

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockSelectResult = [MOCK_USER_ROW];
  });

  describe('認証', () => {
    it('未ログインだと 401 を返す', async () => {
      mockSessionValue = null;

      const res = await req('/api/me');
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('ログイン済みだと 200 を返す', async () => {
      const res = await req('/api/me');
      expect(res.status).toBe(200);
    });
  });

  describe('正常系', () => {
    it('必要な8フィールドのみを返す', async () => {
      const res = await req('/api/me');
      const body = (await res.json()) as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(['bio', 'createdAt', 'email', 'handle', 'id', 'image', 'name', 'updatedAt'].sort());
      expect(body).not.toHaveProperty('emailVerified');
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('token');
    });

    it('handle が null でも 200 を返し壊れない', async () => {
      mockSelectResult = [{ ...MOCK_USER_ROW, handle: null }];

      const res = await req('/api/me');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty('handle', null);
    });
  });

  describe('異常系', () => {
    it('user 行が見つからない場合 500 を返す', async () => {
      mockSelectResult = [];

      const res = await req('/api/me');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'User not found' });
    });
  });
});
