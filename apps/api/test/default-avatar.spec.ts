import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BINDINGS } from './helpers';

let mockSessionValue: unknown = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };

mock.module('../src/lib/auth', () => ({
  createAuth: () => ({
    api: { getSession: async () => mockSessionValue },
    handler: async () => new Response('', { status: 404 }),
  }),
}));

const { default: app } = await import('../src/index');

function req(path: string) {
  return app.request(path, undefined, BINDINGS);
}

describe('GET /api/default-avatar', () => {
  beforeEach(() => {
    mockSessionValue = { user: { id: 'user1', name: 'Test User', email: 'test@example.com' } };
  });

  it('未認証だと 401 を返す', async () => {
    mockSessionValue = null;

    const res = await req('/api/default-avatar?name=Alice');
    expect(res.status).toBe(401);
  });

  it('認証済みで name 指定だと 200 と image/jpeg を返す', async () => {
    const res = await req('/api/default-avatar?name=Alice');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('レスポンスが JPEG の magic number (0xff 0xd8) から始まる', async () => {
    const res = await req('/api/default-avatar?name=Alice');
    const bytes = new Uint8Array(await res.arrayBuffer());

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  it('同じ name なら同じバイナリを返す (deterministic)', async () => {
    const res1 = await req('/api/default-avatar?name=Alice');
    const res2 = await req('/api/default-avatar?name=Alice');

    const buf1 = await res1.arrayBuffer();
    const buf2 = await res2.arrayBuffer();

    expect(Buffer.from(buf1).equals(Buffer.from(buf2))).toBe(true);
  });

  it('name が未指定でも 200 と image/jpeg を返す', async () => {
    const res = await req('/api/default-avatar');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('name が空文字でも 200 と image/jpeg を返す', async () => {
    const res = await req('/api/default-avatar?name=');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('name が空白のみでも 200 と image/jpeg を返す', async () => {
    const res = await req(`/api/default-avatar?name=${encodeURIComponent('   ')}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('Cache-Control ヘッダーが付与される', async () => {
    const res = await req('/api/default-avatar?name=Alice');

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('X-Content-Type-Options: nosniff が付与される', async () => {
    const res = await req('/api/default-avatar?name=Alice');

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('name に SVG/XML を壊す文字が含まれても 200 を返す (injection しない)', async () => {
    const res = await req(`/api/default-avatar?name=${encodeURIComponent('<script>&"\'')}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });
});
