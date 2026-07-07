import { describe, expect, it } from 'bun:test';
import app from '../src/index';

describe('health', () => {
  it('GET /health は 200 を返す', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });
});
