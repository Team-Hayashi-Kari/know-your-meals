import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

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
let mockSelectError: Error | null = null;
let mockUpdateResult: unknown[] = [];
let mockUpdateError: Error | null = null;

const selectWhereMock = mock(async () => {
  if (mockSelectError) throw mockSelectError;
  return mockSelectResult;
});

const updateSetMock = mock((_values: unknown) => ({
  where: () => ({
    returning: async () => {
      if (mockUpdateError) throw mockUpdateError;
      return mockUpdateResult;
    },
  }),
}));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({
    select: () => ({
      from: () => ({
        where: selectWhereMock,
      }),
    }),
    update: () => ({
      set: updateSetMock,
    }),
  }),
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/me', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockSelectResult = [MOCK_USER_ROW];
    mockSelectError = null;
    mockUpdateResult = [];
    mockUpdateError = null;
    selectWhereMock.mockClear();
    updateSetMock.mockClear();
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
    it('user 行が見つからない場合 404 を返す', async () => {
      mockSelectResult = [];

      const res = await req('/api/me');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toEqual({ error: 'User not found' });
    });

    it('DB 問い合わせに失敗した場合 500 を返す', async () => {
      mockSelectError = new Error('db error');

      const res = await req('/api/me');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });
});

function patchMe(body: unknown) {
  return req('/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/me', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockSelectResult = [];
    mockSelectError = null;
    mockUpdateResult = [{ ...MOCK_USER_ROW, name: 'Updated User' }];
    mockUpdateError = null;
    selectWhereMock.mockClear();
    updateSetMock.mockClear();
  });

  describe('認証', () => {
    it('未ログインだと 401 を返す', async () => {
      mockSessionValue = null;

      const res = await patchMe({ name: 'Updated User' });
      expect(res.status).toBe(401);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('ログイン済みだと処理に進み 200 を返す', async () => {
      const res = await patchMe({ name: 'Updated User' });
      expect(res.status).toBe(200);
      expect(updateSetMock).toHaveBeenCalledWith({ name: 'Updated User' });
    });
  });

  describe('正常系', () => {
    it('name だけ更新でき、trim して保存する', async () => {
      await patchMe({ name: '  Updated User  ' });
      expect(updateSetMock).toHaveBeenCalledWith({ name: 'Updated User' });
    });

    it('handle だけ更新でき、trim して保存する', async () => {
      mockUpdateResult = [{ ...MOCK_USER_ROW, handle: 'Yuu_123' }];

      const res = await patchMe({ handle: '  Yuu_123  ' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty('handle', 'Yuu_123');
      expect(updateSetMock).toHaveBeenCalledWith({ handle: 'Yuu_123' });
    });

    it('bio だけ更新でき、trim して保存する', async () => {
      await patchMe({ bio: '  hello  ' });
      expect(updateSetMock).toHaveBeenCalledWith({ bio: 'hello' });
    });

    it('image だけ更新でき、trim して保存する', async () => {
      await patchMe({ image: '  https://example.com/avatar.png  ' });
      expect(updateSetMock).toHaveBeenCalledWith({ image: 'https://example.com/avatar.png' });
    });

    it('複数項目を同時に更新できる', async () => {
      await patchMe({ handle: 'yuu', name: 'Yuu', bio: 'bio', image: 'https://example.com/a.png' });
      expect(updateSetMock).toHaveBeenCalledWith({
        handle: 'yuu',
        name: 'Yuu',
        bio: 'bio',
        image: 'https://example.com/a.png',
      });
    });

    it('未指定項目と許可されていない項目は更新対象に含めない', async () => {
      await patchMe({ name: 'Yuu', email: 'evil@example.com' });
      expect(updateSetMock).toHaveBeenCalledWith({ name: 'Yuu' });
    });

    it('bio: "" は null として保存される', async () => {
      await patchMe({ bio: '' });
      expect(updateSetMock).toHaveBeenCalledWith({ bio: null });
    });

    it('image: "" は null として保存される', async () => {
      await patchMe({ image: '' });
      expect(updateSetMock).toHaveBeenCalledWith({ image: null });
    });

    it('自分自身の既存 handle は 409 にせず更新できる', async () => {
      mockSelectResult = [];

      const res = await patchMe({ handle: 'currentHandle' });
      expect(res.status).toBe(200);
      expect(updateSetMock).toHaveBeenCalledWith({ handle: 'currentHandle' });
    });

    it('Yuu と yuu は別 handle として扱われる', async () => {
      mockSelectResult = [];

      const res = await patchMe({ handle: 'Yuu' });
      expect(res.status).toBe(200);
      expect(updateSetMock).toHaveBeenCalledWith({ handle: 'Yuu' });
    });
  });

  describe('異常系', () => {
    it('空 body {} は 400 を返す', async () => {
      const res = await patchMe({});
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('handle が短すぎる場合は 400 を返す', async () => {
      const res = await patchMe({ handle: 'ab' });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('handle が長すぎる場合は 400 を返す', async () => {
      const res = await patchMe({ handle: 'a'.repeat(31) });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('handle に使用不可文字がある場合は 400 を返す', async () => {
      const res = await patchMe({ handle: 'bad-handle' });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('handle が null の場合は 400 を返す', async () => {
      const res = await patchMe({ handle: null });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('name が空文字の場合は 400 を返す', async () => {
      const res = await patchMe({ name: '   ' });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('name が長すぎる場合は 400 を返す', async () => {
      const res = await patchMe({ name: 'a'.repeat(51) });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('bio が長すぎる場合は 400 を返す', async () => {
      const res = await patchMe({ bio: 'a'.repeat(101) });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('image が URL でない場合は 400 を返す', async () => {
      const res = await patchMe({ image: 'not-url' });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('image が http/https 以外の場合は 400 を返す', async () => {
      const res = await patchMe({ image: 'ftp://example.com/a.png' });
      expect(res.status).toBe(400);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('handle が他ユーザーと重複する場合は 409 を返す', async () => {
      mockSelectResult = [{ id: 'other-user' }];

      const res = await patchMe({ handle: 'taken' });
      expect(res.status).toBe(409);
      expect(updateSetMock).not.toHaveBeenCalled();
    });

    it('DB unique 制約違反は 409 を返す', async () => {
      mockUpdateError = Object.assign(new Error('duplicate key'), { code: '23505' });

      const res = await patchMe({ handle: 'raced' });
      expect(res.status).toBe(409);
    });

    it('session はあるが user 行がない場合は 404 を返す', async () => {
      mockUpdateResult = [];

      const res = await patchMe({ name: 'Updated User' });
      expect(res.status).toBe(404);
    });
  });
});
