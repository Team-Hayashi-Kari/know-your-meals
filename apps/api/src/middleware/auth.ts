import { createMiddleware } from 'hono/factory';
import { createAuth } from '../lib/auth';
import type { Env } from '../types';

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', session.user);
  await next();
});
