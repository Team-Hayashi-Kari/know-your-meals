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
    APP_URL?: string;
  };
};

const app = new Hono<Env>()
  .use(
    cors({
      origin: (origin) => origin ?? 'http://localhost:8081',
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    }),
  )
  .get('/health', (c) => c.json({ status: 'ok' }))
  .on(['GET', 'POST'], '/api/auth/**', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  });

export type AppType = typeof app;
export default app;
