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
const andMock = mock((...args: unknown[]) => ({ type: 'and', args }));
const orMock = mock((...args: unknown[]) => ({ type: 'or', args }));
mock.module('drizzle-orm', () => ({ ...actualDrizzleOrm, eq: eqMock, and: andMock, or: orMock }));

type ImageRow = { postId: number | null; postUserId: string | null } | undefined;
type FriendRow = { id: number } | undefined;

let mockImageRow: ImageRow = { postId: 1, postUserId: 'user1' };
let mockFriendRow: FriendRow = undefined;
let mockR2Object: { body: ReadableStream; httpMetadata?: { contentType?: string } } | null = {
  body: new ReadableStream({ start: (c) => { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } }),
  httpMetadata: { contentType: 'image/jpeg' },
};

const limitMock = mock(() => Promise.resolve(mockFriendRow ? [mockFriendRow] : []));
const friendWhereMock = mock(() => ({ limit: limitMock }));
const imageWhereMock = mock(() => Promise.resolve(mockImageRow ? [mockImageRow] : []));
const leftJoinMock = mock((_table: unknown, _condition: unknown) => ({ where: imageWhereMock }));

const selectMock = mock((_fields: unknown) => ({
  from: mock((_table: unknown) => ({
    leftJoin: leftJoinMock,
    where: friendWhereMock,
  })),
}));

const mockR2Bucket: R2Bucket = {
  get: mock(async (_key: string) => mockR2Object),
} as unknown as R2Bucket;

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({ select: selectMock }),
  images: { postId: 'images.postId', key: 'images.key' },
  posts: { id: 'posts.id', userId: 'posts.userId' },
  friendships: {
    id: 'friendships.id',
    requesterId: 'friendships.requesterId',
    addresseeId: 'friendships.addresseeId',
    status: 'friendships.status',
  },
}));

const { default: app } = await import('../src/index');

function req(path: string, init?: RequestInit) {
  return app.request(path, init, { ...BINDINGS, IMAGES_BUCKET: mockR2Bucket });
}

describe('GET /api/images/:userId/:uuid', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockImageRow = { postId: 1, postUserId: 'user1' };
    mockFriendRow = undefined;
    mockR2Object = {
      body: new ReadableStream({ start: (c) => { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } }),
      httpMetadata: { contentType: 'image/jpeg' },
    };
    eqMock.mockClear();
    andMock.mockClear();
    orMock.mockClear();
    selectMock.mockClear();
    leftJoinMock.mockClear();
    imageWhereMock.mockClear();
    friendWhereMock.mockClear();
    limitMock.mockClear();
    (mockR2Bucket.get as ReturnType<typeof mock>).mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/images/user1/some-uuid');

    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('images レコードが存在しない場合は 404 を返す', async () => {
    mockImageRow = undefined;

    const res = await req('/api/images/user1/nonexistent-uuid');

    expect(res.status).toBe(404);
  });

  it('孤立画像（postUserId が null）は 404 を返す', async () => {
    mockImageRow = { postId: null, postUserId: null };

    const res = await req('/api/images/user1/orphan-uuid');

    expect(res.status).toBe(404);
  });

  it('本人の画像は 200 と画像を返す', async () => {
    const res = await req('/api/images/user1/my-uuid');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('フレンドの画像は 200 を返す', async () => {
    mockSessionValue = { user: { id: 'user2', name: 'Other User', email: 'other@example.com' } };
    mockImageRow = { postId: 1, postUserId: 'user1' };
    mockFriendRow = { id: 99 };

    const res = await req('/api/images/user1/friend-uuid');

    expect(res.status).toBe(200);
  });

  it('フレンドでない他人の画像は 404 を返す', async () => {
    mockSessionValue = { user: { id: 'user3', name: 'Stranger', email: 'stranger@example.com' } };
    mockImageRow = { postId: 1, postUserId: 'user1' };
    mockFriendRow = undefined;

    const res = await req('/api/images/user1/other-uuid');

    expect(res.status).toBe(404);
  });

  it('R2 にオブジェクトが存在しない場合は 404 を返す', async () => {
    mockR2Object = null;

    const res = await req('/api/images/user1/missing-uuid');

    expect(res.status).toBe(404);
  });

  it('不正な Content-Type は application/octet-stream にフォールバックする', async () => {
    mockR2Object = {
      body: new ReadableStream({ start: (c) => { c.close(); } }),
      httpMetadata: { contentType: 'text/html' },
    };

    const res = await req('/api/images/user1/my-uuid');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });
});
