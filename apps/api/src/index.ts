import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './lib/auth';
import { me } from './routes/me';
import { places } from './routes/places';
import type { Env } from './types';

const apiCors = cors({
  origin: ['knowyourmeals://', 'exp://', 'http://localhost:8081'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'expo-origin'],
  credentials: true,
});

const app = new Hono<Env>()
  .get('/health', (c) => c.json({ status: 'ok' }))
  .use('/api/auth/*', apiCors)
  .use('/api/me', apiCors)
  .use('/api/places/*', apiCors)
  .on(['GET', 'POST'], '/api/auth/*', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  })
  .route('/api/me', me)
  .route('/api/places', places);

export type AppType = typeof app;
export default app;
