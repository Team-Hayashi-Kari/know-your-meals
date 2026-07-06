import { Hono } from 'hono';
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
  .on(['GET', 'POST'], '/api/auth/**', (c) => {
    return createAuth(c.env).handler(c.req.raw);
  });

export type AppType = typeof app;
export default app;
