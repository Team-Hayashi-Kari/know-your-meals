import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
import type { PlaceResult } from '../src/lib/places';
import type { Env } from '../src/types';

const mockSearchPlaces = mock<(apiKey: string, params: { query: string; lat: number; lng: number }) => Promise<PlaceResult[]>>(
  () => Promise.resolve([]),
);
const mockRequireAuth = mock(async (_c: unknown, next: () => Promise<void>) => {
  await next();
});

mock.module('../src/lib/places', () => ({ searchPlaces: mockSearchPlaces }));
mock.module('../src/middleware/auth', () => ({ requireAuth: mockRequireAuth }));

const { default: app } = await import('../src/index');

const BINDINGS: Env['Bindings'] = {
  DATABASE_URL: 'postgres://test',
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_PLACES_API_KEY: 'test-api-key',
};

const MOCK_PLACE: PlaceResult = {
  name: '麺屋テスト',
  address: '東京都渋谷区テスト1-2-3',
  location: { lat: 35.68, lng: 139.76 },
  placeId: 'ChIJtest123',
  photos: ['places/ChIJtest123/photos/photo1'],
};

function req(path: string, init?: RequestInit) {
  return app.request(path, init, BINDINGS);
}

describe('GET /api/places/search', () => {
  beforeEach(() => {
    mockSearchPlaces.mockReset();
    mockSearchPlaces.mockResolvedValue([]);
    mockRequireAuth.mockReset();
    mockRequireAuth.mockImplementation(async (_c: unknown, next: () => Promise<void>) => {
      await next();
    });
  });

  describe('認証', () => {
    it('未ログインだと 401 を返す', async () => {
      mockRequireAuth.mockImplementation((c: unknown, _next: unknown) => {
        return (c as Context<Env>).json({ error: 'Unauthorized' }, 401) as unknown as Promise<void>;
      });

      const res = await req('/api/places/search?lat=35.68&lng=139.76');
      expect(res.status).toBe(401);
    });

    it('ログイン済みだと 200 を返す', async () => {
      mockSearchPlaces.mockResolvedValue([MOCK_PLACE]);

      const res = await req('/api/places/search?q=ラーメン&lat=35.68&lng=139.76');
      expect(res.status).toBe(200);
    });
  });

  describe('バリデーション', () => {
    it('lat と lng がないと 400 を返す', async () => {
      const res = await req('/api/places/search?q=ラーメン');
      expect(res.status).toBe(400);
    });

    it('lat のみ欠落で 400 を返す', async () => {
      const res = await req('/api/places/search?q=ラーメン&lng=139.76');
      expect(res.status).toBe(400);
    });

    it('lng のみ欠落で 400 を返す', async () => {
      const res = await req('/api/places/search?q=ラーメン&lat=35.68');
      expect(res.status).toBe(400);
    });

    it('lat が空文字で 400 を返す', async () => {
      const res = await req('/api/places/search?lat=&lng=139.76');
      expect(res.status).toBe(400);
    });

    it('lng が空文字で 400 を返す', async () => {
      const res = await req('/api/places/search?lat=35.68&lng=');
      expect(res.status).toBe(400);
    });

    it('lat が数値以外の文字列で 400 を返す', async () => {
      const res = await req('/api/places/search?lat=abc&lng=139.76');
      expect(res.status).toBe(400);
    });

    it('lng が数値以外の文字列で 400 を返す', async () => {
      const res = await req('/api/places/search?lat=35.68&lng=xyz');
      expect(res.status).toBe(400);
    });
  });

  describe('正常系', () => {
    it('places 配列を返す', async () => {
      mockSearchPlaces.mockResolvedValue([MOCK_PLACE]);

      const res = await req('/api/places/search?q=ラーメン&lat=35.68&lng=139.76');
      const body = (await res.json()) as { places: PlaceResult[] };

      expect(body.places).toBeArray();
      expect(body.places).toHaveLength(1);
    });

    it('各店舗に必要なフィールドが含まれる', async () => {
      mockSearchPlaces.mockResolvedValue([MOCK_PLACE]);

      const res = await req('/api/places/search?q=ラーメン&lat=35.68&lng=139.76');
      const body = (await res.json()) as { places: PlaceResult[] };
      const place = body.places[0];

      expect(place).toBeDefined();
      expect(place).toHaveProperty('name');
      expect(place).toHaveProperty('address');
      expect(place).toHaveProperty('location');
      expect(place).toHaveProperty('placeId');
      expect(place).toHaveProperty('photos');
      expect(place?.location).toHaveProperty('lat');
      expect(place?.location).toHaveProperty('lng');
    });

    it('q なしでも 200 を返す (デフォルトクエリ使用)', async () => {
      mockSearchPlaces.mockResolvedValue([MOCK_PLACE]);

      const res = await req('/api/places/search?lat=35.68&lng=139.76');
      expect(res.status).toBe(200);
    });
  });

  describe('エラー系', () => {
    it('Places API が失敗すると 502 を返す', async () => {
      mockSearchPlaces.mockRejectedValue(new Error('Places API error: 403'));

      const res = await req('/api/places/search?q=ラーメン&lat=35.68&lng=139.76');
      expect(res.status).toBe(502);
    });
  });
});
