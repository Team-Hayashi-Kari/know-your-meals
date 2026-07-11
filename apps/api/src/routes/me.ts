import { bookmarks, createDb, friendships, images, posts, shops, user } from '@repo/db';
import { and, desc, eq, inArray, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Hono } from 'hono';
import { postFriendshipCondition } from '../lib/visibility';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

type ProfileUpdate = {
  handle?: string;
  name?: string;
  bio?: string | null;
  image?: string | null;
};

const profileSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  handle: user.handle,
  bio: user.bio,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

function isObjectBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'cause' in error) &&
    ((error as { code?: unknown }).code === '23505' || (error as { cause?: { code?: unknown } }).cause?.code === '23505')
  );
}

function validateProfileUpdate(body: Record<string, unknown>): ProfileUpdate | { error: string } {
  const update: ProfileUpdate = {};

  if (Object.hasOwn(body, 'handle')) {
    if (typeof body.handle !== 'string') return { error: 'Invalid handle' };
    const handle = body.handle.trim();
    if (handle.length < 3 || handle.length > 30 || !/^[A-Za-z0-9_]+$/.test(handle)) {
      return { error: 'Invalid handle' };
    }
    update.handle = handle;
  }

  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string') return { error: 'Invalid name' };
    const name = body.name.trim();
    if (name.length < 1 || name.length > 50) return { error: 'Invalid name' };
    update.name = name;
  }

  if (Object.hasOwn(body, 'bio')) {
    if (body.bio === null) {
      update.bio = null;
    } else {
      if (typeof body.bio !== 'string') return { error: 'Invalid bio' };
      const bio = body.bio.trim();
      if (bio.length > 100) return { error: 'Invalid bio' };
      update.bio = bio === '' ? null : bio;
    }
  }

  if (Object.hasOwn(body, 'image')) {
    if (body.image === null) {
      update.image = null;
    } else {
      if (typeof body.image !== 'string') return { error: 'Invalid image' };
      const image = body.image.trim();
      if (image === '') {
        update.image = null;
      } else {
        if (image.length > 2048) return { error: 'Invalid image' };
        try {
          const url = new URL(image);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'Invalid image' };
        } catch {
          return { error: 'Invalid image' };
        }
        update.image = image;
      }
    }
  }

  if (Object.keys(update).length === 0) return { error: 'No fields to update' };
  return update;
}

const requester = alias(user, 'requester');
const addressee = alias(user, 'addressee');

type FriendUser = {
  id: string;
  handle: string | null;
  name: string;
  image: string | null;
  bio: string | null;
};

function toFriendUser(friend: FriendUser): FriendUser {
  return {
    id: friend.id,
    handle: friend.handle,
    name: friend.name,
    image: friend.image,
    bio: friend.bio,
  };
}

type Db = ReturnType<typeof createDb>;

async function getMutualFriendCounts(db: Db, authUserId: string, requesterIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(requesterIds.map((id) => [id, 0]));
  if (requesterIds.length === 0) return counts;

  const myFriendRows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.requesterId, authUserId), eq(friendships.addresseeId, authUserId))));

  const myFriendIds = new Set(myFriendRows.map((row) => (row.requesterId === authUserId ? row.addresseeId : row.requesterId)));
  if (myFriendIds.size === 0) return counts;

  const theirFriendRows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(eq(friendships.status, 'accepted'), or(inArray(friendships.requesterId, requesterIds), inArray(friendships.addresseeId, requesterIds))),
    );

  for (const row of theirFriendRows) {
    const requesterSideKnown = requesterIds.includes(row.requesterId);
    const requesterId = requesterSideKnown ? row.requesterId : row.addresseeId;
    const otherId = requesterSideKnown ? row.addresseeId : row.requesterId;
    if (myFriendIds.has(otherId)) counts.set(requesterId, (counts.get(requesterId) ?? 0) + 1);
  }

  return counts;
}

export const me = new Hono<Env>()
  .get('/', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);
    try {
      const [row] = await db.select(profileSelect).from(user).where(eq(user.id, authUser.id));
      if (!row) return c.json({ error: 'User not found' }, 404);
      return c.json(row);
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .patch('/', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!isObjectBody(body)) return c.json({ error: 'Invalid JSON body' }, 400);

    const update = validateProfileUpdate(body);
    if ('error' in update) return c.json({ error: update.error }, 400);

    try {
      if (update.handle !== undefined) {
        const [existingHandleOwner] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.handle, update.handle), ne(user.id, authUser.id)));
        if (existingHandleOwner) return c.json({ error: 'Handle already exists' }, 409);
      }

      const [row] = await db.update(user).set(update).where(eq(user.id, authUser.id)).returning(profileSelect);
      if (!row) return c.json({ error: 'User not found' }, 404);
      return c.json(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) return c.json({ error: 'Handle already exists' }, 409);
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/friends', requireAuth, async (c) => {
    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    try {
      const rows = await db
        .select({
          requesterId: friendships.requesterId,
          requester: {
            id: requester.id,
            handle: requester.handle,
            name: requester.name,
            image: requester.image,
            bio: requester.bio,
          },
          addressee: {
            id: addressee.id,
            handle: addressee.handle,
            name: addressee.name,
            image: addressee.image,
            bio: addressee.bio,
          },
        })
        .from(friendships)
        .innerJoin(requester, eq(friendships.requesterId, requester.id))
        .innerJoin(addressee, eq(friendships.addresseeId, addressee.id))
        .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.requesterId, authUser.id), eq(friendships.addresseeId, authUser.id))))
        .orderBy(desc(friendships.updatedAt), desc(friendships.createdAt));

      const friends = rows
        .map((row) => {
          const friend = row.requesterId === authUser.id ? row.addressee : row.requester;
          return {
            id: friend.id,
            handle: friend.handle,
            name: friend.name,
            image: friend.image,
            bio: friend.bio,
          } satisfies FriendUser;
        })
        .filter((friend) => friend.id !== authUser.id);

      return c.json(friends);
    } catch {
      return c.json({ error: 'Internal server error' }, 500);
    }
  })
  .get('/friend-requests', requireAuth, async (c) => {
    const direction = c.req.query('direction');
    if (!['received', 'sent'].includes(direction ?? '')) return c.json({ error: 'Invalid direction' }, 400);

    const authUser = c.get('user');
    const db = createDb(c.env.DATABASE_URL);

    try {
      let rows: (FriendUser & { friendshipId?: number; mutualFriendCount?: number })[] = [];

      if (direction === 'received') {
        const receivedRows = await db
          .select({
            friendshipId: friendships.id,
            requester: {
              id: requester.id,
              handle: requester.handle,
              name: requester.name,
              image: requester.image,
              bio: requester.bio,
            },
          })
          .from(friendships)
          .innerJoin(requester, eq(friendships.requesterId, requester.id))
          .where(and(eq(friendships.status, 'pending'), eq(friendships.addresseeId, authUser.id)))
          .orderBy(desc(friendships.createdAt));

        const mutualCounts = await getMutualFriendCounts(
          db,
          authUser.id,
          receivedRows.map((row) => row.requester.id),
        );

        rows = receivedRows.map((row) => ({
          friendshipId: row.friendshipId,
          ...toFriendUser(row.requester),
          mutualFriendCount: mutualCounts.get(row.requester.id) ?? 0,
        }));
      } else {
        const sentRows = await db
          .select({
            addressee: {
              id: addressee.id,
              handle: addressee.handle,
              name: addressee.name,
              image: addressee.image,
              bio: addressee.bio,
            },
          })
          .from(friendships)
          .innerJoin(addressee, eq(friendships.addresseeId, addressee.id))
          .where(and(eq(friendships.status, 'pending'), eq(friendships.requesterId, authUser.id)))
          .orderBy(desc(friendships.createdAt));

        rows = sentRows.map((row) => toFriendUser(row.addressee));
      }

      return c.json(rows);
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
        .leftJoin(friendships, postFriendshipCondition(authUser.id))
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
