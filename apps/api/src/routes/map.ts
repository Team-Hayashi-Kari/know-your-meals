import { createDb, friendships, images, posts, shops, user } from '@repo/db';
import { and, between, desc, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { postFriendshipCondition } from '../lib/visibility';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

const MAX_PINS = 50;

function parseBbox(raw: string | undefined): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 4) return null;
  if (parts.some((p) => p === '')) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [swLat, swLng, neLat, neLng] = nums as [number, number, number, number];
  if (swLat > neLat || swLng > neLng) return null;
  return [swLat, swLng, neLat, neLng];
}

export const mapRoute = new Hono<Env>().get('/posts', requireAuth, async (c) => {
  const authUser = c.get('user');
  const bbox = parseBbox(c.req.query('bbox'));
  if (!bbox) return c.json({ error: 'bbox must be swLat,swLng,neLat,neLng (4 finite numbers, sw <= ne)' }, 400);

  const [swLat, swLng, neLat, neLng] = bbox;
  const db = createDb(c.env.DATABASE_URL);

  const rows = await db
    .select({
      postId: posts.id,
      pin: posts.pin,
      comment: posts.comment,
      createdAt: posts.createdAt,
      lat: shops.lat,
      lng: shops.lng,
      shopName: shops.name,
      imageKey: images.key,
      author: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        image: user.image,
      },
    })
    .from(posts)
    .innerJoin(shops, eq(posts.shopId, shops.id))
    .innerJoin(user, eq(posts.userId, user.id))
    .leftJoin(images, eq(images.postId, posts.id))
    .leftJoin(friendships, postFriendshipCondition(authUser.id))
    .where(
      and(or(eq(posts.userId, authUser.id), eq(friendships.status, 'accepted')), between(shops.lat, swLat, neLat), between(shops.lng, swLng, neLng)),
    )
    .orderBy(desc(posts.createdAt))
    .limit(MAX_PINS);

  const pins = rows.map(({ imageKey, ...rest }) => ({
    ...rest,
    imageUrl: imageKey ? `/api/images/${imageKey}` : null,
  }));

  return c.json({ pins });
});
