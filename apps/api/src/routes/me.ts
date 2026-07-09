import { bookmarks, createDb, friendships, images, posts, shops, user } from '@repo/db';
import { and, desc, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { friendshipPairCondition } from '../lib/visibility';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

export const me = new Hono<Env>()
  .get('/', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);
    try {
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
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/posts', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);
    try {
      const rows = await db
        .select({
          id: posts.id,
          comment: posts.comment,
          pin: posts.pin,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          imageKey: images.key,
          shop: {
            id: shops.id,
            googlePlaceId: shops.googlePlaceId,
            name: shops.name,
            address: shops.address,
            lat: shops.lat,
            lng: shops.lng,
          },
        })
        .from(posts)
        .innerJoin(shops, eq(posts.shopId, shops.id))
        .leftJoin(images, eq(images.postId, posts.id))
        .where(eq(posts.userId, authUser.id))
        .orderBy(desc(posts.createdAt));

      return c.json(
        rows.map(({ imageKey, ...post }) => ({
          ...post,
          imageUrl: imageKey ? `/api/images/${imageKey}` : null,
        })),
      );
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/bookmarks', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);
    try {
      const rows = await db
        .select({
          id: posts.id,
          comment: posts.comment,
          pin: posts.pin,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          imageKey: images.key,
          shop: {
            id: shops.id,
            googlePlaceId: shops.googlePlaceId,
            name: shops.name,
            address: shops.address,
            lat: shops.lat,
            lng: shops.lng,
          },
          author: {
            id: user.id,
            handle: user.handle,
            name: user.name,
            image: user.image,
          },
        })
        .from(bookmarks)
        .innerJoin(posts, eq(bookmarks.postId, posts.id))
        .innerJoin(shops, eq(posts.shopId, shops.id))
        .leftJoin(images, eq(images.postId, posts.id))
        .innerJoin(user, eq(posts.userId, user.id))
        .leftJoin(friendships, friendshipPairCondition(authUser.id))
        .where(and(eq(bookmarks.userId, authUser.id), or(eq(posts.userId, authUser.id), eq(friendships.status, 'accepted'))))
        .orderBy(desc(bookmarks.createdAt));

      return c.json(
        rows.map(({ imageKey, ...post }) => ({
          ...post,
          imageUrl: imageKey ? `/api/images/${imageKey}` : null,
        })),
      );
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
