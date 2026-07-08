import { createDb, user } from '@repo/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

export const me = new Hono<Env>().get('/', requireAuth, async (c) => {
  const authUser = c.get('user');
  const db = createDb(c.env.DATABASE_URL);
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      handle: user.handle,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, authUser.id));
  if (!row) return c.json({ error: 'User not found' }, 404);
  return c.json(row);
});
