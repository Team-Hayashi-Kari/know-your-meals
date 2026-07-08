import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { PlaceResult } from '../src/lib/places';
import type { Env } from '../src/types';

// `getSession` の戻り値を各テストで切り替える
let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const mockSearchPlaces = mock<(apiKey: string, params: { query: string; lat: number; lng: number }) => Promise<PlaceResult[]>>(() =>
  Promise.resolve([]),
);

mock.module('../src/lib/places', () => ({ searchPlaces: mockSearchPlaces }));

const { default: app } = await import('../src/index');

const BINDINGS: Env['Bindings'] = {
  DATABASE_URL: 'postgres://test',
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_PLACES_API_KEY: 'test-api-key',
  IMAGES_BUCKET: {} as R2Bucket,
  IMAGES_BASE_URL: 'https://test.r2.dev',
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
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
  });

  describe('認証', () => {
    it('未ログインだと 401 を返す', async () => {
      mockSessionValue = null;

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
