import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { PlaceResult } from '../src/lib/places';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const mockGetPlaceDetails = mock<(apiKey: string, googlePlaceId: string) => Promise<PlaceResult | null>>(() => Promise.resolve(null));

mock.module('../src/lib/places', () => ({
  searchPlaces: mock(() => Promise.resolve([])),
  getPlaceDetails: mockGetPlaceDetails,
}));

let selectResult: unknown[] = [];
let insertReturning: unknown[] = [];
let insertShouldReject = false;
const whereMock = mock((_cond: unknown) => Promise.resolve(selectResult));
const fromMock = mock(() => ({ where: whereMock }));
const selectMock = mock((_cols: unknown) => ({ from: fromMock }));

const onConflictDoUpdateMock = mock((_opts: unknown) => ({
  returning: () => (insertShouldReject ? Promise.reject(new Error('DB error')) : Promise.resolve(insertReturning)),
}));
const valuesMock = mock((_vals: unknown) => ({ onConflictDoUpdate: onConflictDoUpdateMock }));
const insertMock = mock((_table: unknown) => ({ values: valuesMock }));

const mockDb = { select: selectMock, insert: insertMock };

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({ ...actualDb, createDb: () => mockDb }));

const { default: app } = await import('../src/index');

const CACHED_SHOP = {
  id: 1,
  googlePlaceId: 'ChIJcached',
  name: 'キャッシュ済み店',
  address: '東京都渋谷区1-1-1',
  lat: 35.65,
  lng: 139.7,
};

const MOCK_PLACE: PlaceResult = {
  name: '新規店舗',
  address: '東京都新宿区2-2-2',
  location: { lat: 35.69, lng: 139.7 },
  placeId: 'ChIJnew',
  photos: [],
};

const UPSERTED_SHOP = {
  id: 2,
  googlePlaceId: MOCK_PLACE.placeId,
  name: MOCK_PLACE.name,
  address: MOCK_PLACE.address,
  lat: MOCK_PLACE.location.lat,
  lng: MOCK_PLACE.location.lng,
};

function getShop(googlePlaceId: string) {
  return app.request(`/api/shops/${googlePlaceId}`, undefined, BINDINGS);
}

describe('GET /api/shops/:googlePlaceId', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    selectResult = [];
    insertReturning = [];
    insertShouldReject = false;
    mockGetPlaceDetails.mockReset();
    mockGetPlaceDetails.mockResolvedValue(null);
    selectMock.mockClear();
    fromMock.mockClear();
    whereMock.mockClear();
    insertMock.mockClear();
    valuesMock.mockClear();
    onConflictDoUpdateMock.mockClear();
  });

  it('未ログインだと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await getShop('ChIJcached');
    expect(res.status).toBe(401);
  });

  it('DB キャッシュにある場合は 200 で { shop } を返し、Place Details は呼ばれない', async () => {
    selectResult = [CACHED_SHOP];

    const res = await getShop('ChIJcached');
    const body = (await res.json()) as { shop: typeof CACHED_SHOP };

    expect(res.status).toBe(200);
    expect(body.shop).toEqual(CACHED_SHOP);
    expect(mockGetPlaceDetails).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('DB に無く Place Details で見つかる場合、Place Details を呼び upsert して 200 を返す', async () => {
    selectResult = [];
    mockGetPlaceDetails.mockResolvedValue(MOCK_PLACE);
    insertReturning = [UPSERTED_SHOP];

    const res = await getShop('ChIJnew');
    const body = (await res.json()) as { shop: typeof UPSERTED_SHOP };

    expect(res.status).toBe(200);
    expect(mockGetPlaceDetails).toHaveBeenCalledWith(BINDINGS.GOOGLE_PLACES_API_KEY, 'ChIJnew');
    expect(insertMock).toHaveBeenCalled();
    expect(onConflictDoUpdateMock).toHaveBeenCalled();
    expect(body.shop).toEqual(UPSERTED_SHOP);
  });

  it('DB にも Place Details にも無い場合は 404 を返す', async () => {
    selectResult = [];
    mockGetPlaceDetails.mockResolvedValue(null);

    const res = await getShop('ChIJnothing');
    expect(res.status).toBe(404);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('Place Details helper が throw した場合は 502 を返す', async () => {
    selectResult = [];
    mockGetPlaceDetails.mockRejectedValue(new Error('Place Details API error: 500'));

    const res = await getShop('ChIJerror');
    expect(res.status).toBe(502);
  });

  it('DB upsert が空配列を返した場合は 500 を返す', async () => {
    selectResult = [];
    mockGetPlaceDetails.mockResolvedValue(MOCK_PLACE);
    insertReturning = [];

    const res = await getShop('ChIJfail');
    expect(res.status).toBe(500);
  });

  it('DB upsert が reject した場合は 500 を返す', async () => {
    selectResult = [];
    mockGetPlaceDetails.mockResolvedValue(MOCK_PLACE);
    insertShouldReject = true;

    const res = await getShop('ChIJdberror');
    expect(res.status).toBe(500);
  });
});
