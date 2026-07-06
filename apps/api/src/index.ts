import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './lib/auth';

type Env = {
  Bindings: {
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  };
};

const app = new Hono<Env>()
  .get('/health', (c) => c.json({ status: 'ok' }))
  .use(
    '/api/auth/**',
    cors({
      origin: ['knowyourmeals://', 'exp://', 'http://localhost:8081'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'expo-origin'],
      credentials: true,
    }),
  )
  .on(['GET', 'POST'], '/api/auth/**', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  });

export type AppType = typeof app;
export default app;
