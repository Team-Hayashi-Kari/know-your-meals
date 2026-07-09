import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './lib/auth';
import { friendshipsRoute } from './routes/friendships';
import { imagesRoute } from './routes/images';
import { me } from './routes/me';
import { places } from './routes/places';
import { postsRoute } from './routes/posts';
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
  .use('/api/posts/*', apiCors)
  .use('/api/friendships/*', apiCors)
  .use('/api/images/*', apiCors)
  .on(['GET', 'POST'], '/api/auth/*', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  })
  .route('/api/me', me)
  .route('/api/places', places)
  .route('/api/friendships', friendshipsRoute)
  .route('/api/posts', postsRoute)
  .route('/api/images', imagesRoute);

export type AppType = typeof app;
export default app;
