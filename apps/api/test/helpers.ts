import type { Env } from '../src/types';

export const BINDINGS: Env['Bindings'] = {
  DATABASE_URL: 'postgres://test',
  BETTER_AUTH_SECRET: 'test-secret',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_PLACES_API_KEY: 'test-api-key',
  IMAGES_BUCKET: {} as R2Bucket,
  IMAGES_BASE_URL: 'https://test.r2.dev',
};
