import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './lib/auth';
import { defaultAvatarRoute } from './routes/default-avatar';
import { friendshipsRoute } from './routes/friendships';
import { imagesRoute } from './routes/images';
import { mapRoute } from './routes/map';
import { me } from './routes/me';
import { places } from './routes/places';
import { postsRoute } from './routes/posts';
import { shopsRoute } from './routes/shops';
import { usersRoute } from './routes/users';
import type { Env } from './types';

const apiCors = cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'https://know-your-meals.pages.dev',
      'https://know-your-meals.com',
      'https://www.know-your-meals.com',
    ];
    if (!origin) return null;
    if (allowed.includes(origin) || origin.startsWith('exp://')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'expo-origin'],
  credentials: true,
});

const app = new Hono<Env>()
  .get('/health', (c) => c.json({ status: 'ok' }))
  .use('/api/auth/*', apiCors)
  .use('/api/me', apiCors)
  .use('/api/me/*', apiCors)
  .use('/api/places/*', apiCors)
  .use('/api/shops/*', apiCors)
  .use('/api/posts/*', apiCors)
  .use('/api/friendships/*', apiCors)
  .use('/api/images/*', apiCors)
  .use('/api/map/*', apiCors)
  .use('/api/users/*', apiCors)
  .use('/api/default-avatar', apiCors)
  .on(['GET', 'POST'], '/api/auth/*', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  })
  .route('/api/me', me)
  .route('/api/places', places)
  .route('/api/shops', shopsRoute)
  .route('/api/friendships', friendshipsRoute)
  .route('/api/posts', postsRoute)
  .route('/api/images', imagesRoute)
  .route('/api/users', usersRoute)
  .route('/api/default-avatar', defaultAvatarRoute)
  .route('/api/map', mapRoute);

export type AppType = typeof app;
export default app;
