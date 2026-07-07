import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('health', () => {
  it('GET /health は 200 を返す', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
  });
});
