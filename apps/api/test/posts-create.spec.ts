import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const mockShop = { id: 1, googlePlaceId: 'place1', name: 'Test Shop', address: null, lat: 35.0, lng: 139.0 };
const mockPost = { id: 10, userId: 'user1', shopId: 1, comment: null, pin: '🍜', createdAt: new Date() };
const mockImage = { id: 100, postId: 10, key: 'user1/test-uuid' };

type InsertConfig = { result?: unknown[]; throws?: boolean };
let insertConfigs: InsertConfig[] = [];
let insertCallCount = 0;

const returningMock = mock(async () => {
  const config = insertConfigs[insertCallCount++];
  if (config?.throws) throw new Error('DB error');
  return config?.result ?? [];
});

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({
    insert: mock(() => ({
      values: mock(() => ({
        onConflictDoUpdate: mock(() => ({ returning: returningMock })),
        returning: returningMock,
      })),
    })),
  }),
  shops: {},
  posts: {},
  images: {},
}));

let r2PutShouldThrow = false;
const r2PutMock = mock(async () => {
  if (r2PutShouldThrow) throw new Error('R2 error');
});
const r2DeleteMock = mock(async (_key: string) => {});

const TEST_BINDINGS = {
  ...BINDINGS,
  IMAGES_BUCKET: { put: r2PutMock, delete: r2DeleteMock } as unknown as R2Bucket,
};

const { default: app } = await import('../src/index');

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function makeFormData() {
  const fd = new FormData();
  fd.append('shop', JSON.stringify({ googlePlaceId: 'place1', name: 'Test Shop', lat: 35.0, lng: 139.0 }));
  fd.append('pin', '🍜');
  fd.append('image', new File([JPEG_MAGIC], 'test.jpg', { type: 'image/jpeg' }));
  return fd;
}

function req() {
  return app.request('/api/posts', { method: 'POST', body: makeFormData() }, TEST_BINDINGS);
}

describe('POST /api/posts', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    insertConfigs = [];
    insertCallCount = 0;
    r2PutShouldThrow = false;
    returningMock.mockClear();
    r2PutMock.mockClear();
    r2DeleteMock.mockClear();
  });

  it('正常投稿で 200 と投稿データを返す', async () => {
    insertConfigs = [{ result: [mockShop] }, { result: [mockPost] }, { result: [mockImage] }];
    const res = await req();
    expect(res.status).toBe(200);
    const body = await res.json<{ post: { id: number } }>();
    expect(body.post.id).toBe(10);
    expect(r2PutMock).toHaveBeenCalledTimes(1);
    expect(r2DeleteMock).not.toHaveBeenCalled();
  });

  it('shop upsert が例外を投げた場合、R2 cleanup して 500 を返す', async () => {
    insertConfigs = [{ throws: true }];
    const res = await req();
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Failed to upsert shop');
    expect(r2DeleteMock).toHaveBeenCalledTimes(1);
  });

  it('R2 put が失敗した場合、R2 cleanup して 500 を返す', async () => {
    insertConfigs = [{ result: [mockShop] }];
    r2PutShouldThrow = true;
    const res = await req();
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Failed to upsert shop');
    expect(r2DeleteMock).toHaveBeenCalledTimes(1);
  });

  it('post insert が失敗した場合、R2 cleanup して 500 を返す', async () => {
    insertConfigs = [{ result: [mockShop] }, { throws: true }];
    const res = await req();
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Failed to save post');
    expect(r2DeleteMock).toHaveBeenCalledTimes(1);
  });
});
