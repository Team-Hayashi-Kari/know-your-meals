import { createDb, friendships, images, posts } from '@repo/db';
import { and, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { createAuth } from '../lib/auth';
import { postFriendshipCondition } from '../lib/visibility';
import type { Env } from '../types';

export const imagesRoute = new Hono<Env>().get('/:userId/:uuid', async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const authUser = session.user;
  const { userId, uuid } = c.req.param();
  const key = `${userId}/${uuid}`;

  const db = createDb(c.env.DATABASE_URL);

  const [row] = await db
    .select({ id: images.id })
    .from(images)
    .innerJoin(posts, eq(images.postId, posts.id))
    .leftJoin(friendships, postFriendshipCondition(authUser.id))
    .where(and(eq(images.key, key), or(eq(posts.userId, authUser.id), eq(friendships.status, 'accepted'))));

  if (!row) return c.json({ error: 'Image Not found' }, 404);

  const obj = await c.env.IMAGES_BUCKET.get(key);
  if (!obj) return c.json({ error: 'Image Not found' }, 404);

  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const contentType = obj.httpMetadata?.contentType ?? '';
  const safeContentType = ALLOWED_TYPES.has(contentType) ? contentType : 'application/octet-stream';

  return new Response(obj.body, {
    headers: {
      'Content-Type': safeContentType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
