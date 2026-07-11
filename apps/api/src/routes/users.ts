import { createDb, friendships, images, posts, shops, user } from '@repo/db';
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { deriveRelationship, friendshipPairCondition } from '../lib/friendship';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

const friendshipRowSelect = {
  id: friendships.id,
  status: friendships.status,
  requesterId: friendships.requesterId,
  addresseeId: friendships.addresseeId,
};

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

export const usersRoute = new Hono<Env>()
  .get('/search', requireAuth, async (c) => {
    const currentUser = c.get('user');
    const rawQuery = c.req.query('q') ?? '';
    const rawPage = c.req.query('page') ?? '1';
    const rawLimit = c.req.query('limit') ?? String(LIMIT_DEFAULT);

    const pageNumber = rawPage === '' ? NaN : Number(rawPage);
    const limitNumber = rawLimit === '' ? NaN : Number(rawLimit);

    if (Number.isNaN(pageNumber) || Number.isNaN(limitNumber)) {
      return c.json({ error: 'invalid page/limit' }, 400);
    }

    const page = Math.max(1, pageNumber);
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitNumber));

    const isHandleOnly = rawQuery.startsWith('@');
    const query = isHandleOnly ? rawQuery.slice(1).trim() : rawQuery.trim();

    if (query.length === 0) {
      return c.json({ error: 'q is required' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    const searchCondition = isHandleOnly ? ilike(user.handle, pattern) : or(ilike(user.name, pattern), ilike(user.handle, pattern));
    const where = and(searchCondition, ne(user.id, currentUser.id));

    try {
      const [countResult, users] = await Promise.all([
        db.select({ total: count() }).from(user).where(where),
        db
          .select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
          .from(user)
          .where(where)
          .orderBy(asc(user.name), asc(user.id))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);
      const total = countResult[0]?.total ?? 0;
      const hasMore = page * limit < total;

      const ids = users.map((u) => u.id);
      const friendshipRows = ids.length
        ? await db
            .select(friendshipRowSelect)
            .from(friendships)
            .where(
              or(
                and(eq(friendships.requesterId, currentUser.id), inArray(friendships.addresseeId, ids)),
                and(eq(friendships.addresseeId, currentUser.id), inArray(friendships.requesterId, ids)),
              ),
            )
        : [];
      const relationshipByUserId = new Map(
        friendshipRows.map((row) => [row.requesterId === currentUser.id ? row.addresseeId : row.requesterId, row]),
      );

      return c.json({
        users: users.map((u) => ({ ...u, ...deriveRelationship(relationshipByUserId.get(u.id), currentUser.id) })),
        nextPage: hasMore ? page + 1 : null,
      });
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/check-handle', requireAuth, async (c) => {
    const currentUser = c.get('user');
    const handle = (c.req.query('handle') ?? '').trim();

    if (handle.length < 3 || handle.length > 30 || !/^[A-Za-z0-9_]+$/.test(handle)) {
      return c.json({ error: 'Invalid handle' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    try {
      const [existingHandleOwner] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.handle, handle), ne(user.id, currentUser.id)));

      return c.json({ available: !existingHandleOwner });
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/:handle/posts', requireAuth, async (c) => {
    const authUser = c.get('user');
    const handle = c.req.param('handle');

    const rawPage = c.req.query('page') ?? '1';
    const rawLimit = c.req.query('limit') ?? String(LIMIT_DEFAULT);
    const pageNumber = rawPage === '' ? NaN : Number(rawPage);
    const limitNumber = rawLimit === '' ? NaN : Number(rawLimit);
    if (Number.isNaN(pageNumber) || Number.isNaN(limitNumber)) {
      return c.json({ error: 'invalid page/limit' }, 400);
    }
    const page = Math.max(1, pageNumber);
    const limit = Math.min(LIMIT_MAX, Math.max(1, limitNumber));

    const db = createDb(c.env.DATABASE_URL);

    try {
      const [targetUser] = await db
        .select({ id: user.id })
        .from(user)
        .leftJoin(friendships, and(eq(friendships.status, 'accepted'), friendshipPairCondition(authUser.id, user.id)))
        .where(and(eq(user.handle, handle), or(eq(user.id, authUser.id), isNotNull(friendships.id))));
      if (!targetUser) return c.json({ error: 'User not found' }, 404);

      const where = eq(posts.userId, targetUser.id);
      const [countResult, rows] = await Promise.all([
        db.select({ total: count() }).from(posts).where(where),
        db
          .select({
            id: posts.id,
            pin: posts.pin,
            createdAt: posts.createdAt,
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
          .where(where)
          .orderBy(desc(posts.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);

      const total = countResult[0]?.total ?? 0;
      const hasMore = page * limit < total;
      return c.json({
        posts: rows.map(({ imageKey, ...post }) => ({
          ...post,
          imageUrl: imageKey ? `/api/images/${imageKey}` : null,
        })),
        nextPage: hasMore ? page + 1 : null,
      });
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/:handle', requireAuth, async (c) => {
    const authUser = c.get('user');
    const rawHandle = c.req.param('handle');
    const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle;

    if (!handle) {
      return c.json({ error: 'handle is required' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    try {
      const [found] = await db
        .select({ id: user.id, name: user.name, handle: user.handle, image: user.image, bio: user.bio })
        .from(user)
        .where(eq(user.handle, handle));

      if (!found) return c.json({ error: 'User not found' }, 404);

      const [postCountResult, friendCountResult, friendshipRows] = await Promise.all([
        db.select({ total: count() }).from(posts).where(eq(posts.userId, found.id)),
        db
          .select({ total: count() })
          .from(friendships)
          .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.requesterId, found.id), eq(friendships.addresseeId, found.id)))),
        db.select(friendshipRowSelect).from(friendships).where(friendshipPairCondition(authUser.id, found.id)),
      ]);

      return c.json({
        ...found,
        postCount: postCountResult[0]?.total ?? 0,
        friendCount: friendCountResult[0]?.total ?? 0,
        ...deriveRelationship(friendshipRows[0], authUser.id),
      });
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
