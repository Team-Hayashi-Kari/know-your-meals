import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

let mockPostResult: { id: number }[] = [{ id: 1 }];
let mockImageResult: { key: string }[] = [{ key: 'user1/test-uuid' }];

// from のテーブル引数で posts / images を判別（posts mock は userId を持つ）
const selectMock = mock((_fields: unknown) => ({
  from: mock((table: Record<string, unknown>) => ({
    where: mock(() => ('userId' in table ? Promise.resolve(mockPostResult) : Promise.resolve(mockImageResult))),
  })),
}));

const deleteWhereMock = mock(() => Promise.resolve([]));
const deleteMock = mock((_table: unknown) => ({ where: deleteWhereMock }));

const actualDb = await import('@repo/db');
mock.module('@repo/db', () => ({
  ...actualDb,
  createDb: () => ({ select: selectMock, delete: deleteMock }),
  posts: { id: 'posts.id', userId: 'posts.userId' },
  images: { postId: 'images.postId', key: 'images.key' },
}));

let r2DeleteShouldThrow = false;
const r2DeleteMock = mock(async (_key: string) => {
  if (r2DeleteShouldThrow) throw new Error('R2 error');
});

const TEST_BINDINGS = {
  ...BINDINGS,
  IMAGES_BUCKET: { delete: r2DeleteMock } as unknown as R2Bucket,
};

const { default: app } = await import('../src/index');

function req(path: string) {
  return app.request(path, { method: 'DELETE' }, TEST_BINDINGS);
}

describe('DELETE /api/posts/:id', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
    mockPostResult = [{ id: 1 }];
    mockImageResult = [{ key: 'user1/test-uuid' }];
    r2DeleteShouldThrow = false;
    selectMock.mockClear();
    deleteMock.mockClear();
    deleteWhereMock.mockClear();
    r2DeleteMock.mockClear();
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;
    const res = await req('/api/posts/1');
    expect(res.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('id が数値でない場合は 400 を返す', async () => {
    const res = await req('/api/posts/abc');
    expect(res.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('存在しない / 他人の投稿は 404 を返す', async () => {
    mockPostResult = [];
    const res = await req('/api/posts/999');
    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('正常削除（R2 成功）で 204 を返す', async () => {
    const res = await req('/api/posts/1');
    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteMock.mock.calls[0]?.[0]).toEqual({ postId: 'images.postId', key: 'images.key' }); // images 先
    expect(deleteMock.mock.calls[1]?.[0]).toEqual({ id: 'posts.id', userId: 'posts.userId' }); // posts 後
    expect(r2DeleteMock).toHaveBeenCalledWith('user1/test-uuid');
  });

  it('R2 削除失敗でも 204 を返す（DB は一貫している）', async () => {
    r2DeleteShouldThrow = true;
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
    const res = await req('/api/posts/1');
    consoleSpy.mockRestore();
    expect(res.status).toBe(204);
    expect(deleteWhereMock).toHaveBeenCalledTimes(2); // images + posts 両方削除済み
    expect(r2DeleteMock).toHaveBeenCalledTimes(1);
  });

  it('画像なし投稿でも 204 を返す', async () => {
    mockImageResult = [];
    const res = await req('/api/posts/1');
    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledTimes(1); // posts のみ
    expect(r2DeleteMock).not.toHaveBeenCalled();
  });
});
