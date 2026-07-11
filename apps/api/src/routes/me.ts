import { bookmarks, createDb, friendships, images, posts, shops, user } from '@repo/db';
import { and, desc, eq, ne, or, type SQLWrapper, sql } from 'drizzle-orm';
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

// userA・userB 双方の accepted フレンドの共通数（自分と申請者の共通フレンド数の算出用）
// SQL生成そのものは test/me-mutual-friend-count.spec.ts で検証するため export する
export function mutualFriendCountSql(userA: SQLWrapper, userB: SQLWrapper) {
  return sql<number>`(
    SELECT COUNT(*)::int FROM (
      SELECT CASE WHEN f1.requester_id = ${userA} THEN f1.addressee_id ELSE f1.requester_id END AS friend_id
      FROM friendships f1
      WHERE f1.status = 'accepted' AND (f1.requester_id = ${userA} OR f1.addressee_id = ${userA})
    ) my_friends
    JOIN (
      SELECT CASE WHEN f2.requester_id = ${userB} THEN f2.addressee_id ELSE f2.requester_id END AS friend_id
      FROM friendships f2
      WHERE f2.status = 'accepted' AND (f2.requester_id = ${userB} OR f2.addressee_id = ${userB})
    ) their_friends ON my_friends.friend_id = their_friends.friend_id
  )`;
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
            mutualFriendCount: mutualFriendCountSql(sql`${authUser.id}`, requester.id),
          })
          .from(friendships)
          .innerJoin(requester, eq(friendships.requesterId, requester.id))
          .where(and(eq(friendships.status, 'pending'), eq(friendships.addresseeId, authUser.id)))
          .orderBy(desc(friendships.createdAt));

        return c.json(
          receivedRows.map((row) => ({
            friendshipId: row.friendshipId,
            ...toFriendUser(row.requester),
            mutualFriendCount: row.mutualFriendCount,
          })),
        );
      }

      // sent: 取消(DELETE /api/friendships/:id)と申請日表示に必要な friendshipId / requestedAt も一緒に返す
      const sentRows = await db
        .select({
          friendshipId: friendships.id,
          requestedAt: friendships.createdAt,
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

      return c.json(
        sentRows.map((row) => ({
          ...toFriendUser(row.addressee),
          friendshipId: row.friendshipId,
          requestedAt: row.requestedAt,
        })),
      );
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
