import { createDb, friendships, user } from '@repo/db';
import { and, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

type CreateFriendshipBody = {
  handle?: string;
  id?: string;
};

type UpdateFriendshipBody = {
  status?: string;
};

export const friendshipsRoute = new Hono<Env>()
  .post('/', requireAuth, async (c) => {
    const currentUser = c.get('user');
    const body = await c.req.json<CreateFriendshipBody>().catch(() => null);
    const rawId = body?.id as unknown;
    const rawHandle = body?.handle as unknown;

    // id が指定されている場合は id 優先で処理する。型不正なら handle にフォールバックせず 400 とする
    if (rawId !== undefined && typeof rawId !== 'string') {
      return c.json({ error: 'id must be a string' }, 400);
    }
    const targetId = rawId as string | undefined;
    const targetHandle = typeof rawHandle === 'string' ? rawHandle : undefined;

    if (!targetId && !targetHandle) {
      return c.json({ error: 'id or handle is required' }, 400);
    }
    if (targetId && targetId === currentUser.id) {
      return c.json({ error: 'Cannot send a friend request to yourself' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const [target] = targetId
      ? await db.select().from(user).where(eq(user.id, targetId))
      : await db
          .select()
          .from(user)
          .where(eq(user.handle, targetHandle as string));

    if (!target) return c.json({ error: 'User not found' }, 404);
    if (target.id === currentUser.id) {
      return c.json({ error: 'Cannot send a friend request to yourself' }, 400);
    }

    const [existing] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, currentUser.id), eq(friendships.addresseeId, target.id)),
          and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, currentUser.id)),
        ),
      );

    if (existing) {
      if (existing.requesterId !== currentUser.id || existing.status === 'pending' || existing.status === 'accepted') {
        return c.json({ error: 'Friendship request already exists' }, 409);
      }
      const [updated] = await db.update(friendships).set({ status: 'pending' }).where(eq(friendships.id, existing.id)).returning();
      return c.json(updated, 201);
    }

    try {
      const [created] = await db.insert(friendships).values({ requesterId: currentUser.id, addresseeId: target.id, status: 'pending' }).returning();
      return c.json(created, 201);
    } catch (err) {
      // 同時リクエストによる unique 制約違反(23505)は競合として 409 に変換する
      if ((err as { code?: string } | undefined)?.code === '23505') {
        return c.json({ error: 'Friendship request already exists' }, 409);
      }
      throw err;
    }
  })
  .patch('/:id', requireAuth, async (c) => {
    const currentUser = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid friendship id' }, 400);
    const body = await c.req.json<UpdateFriendshipBody>().catch(() => null);
    const status = body?.status;

    if (!body || (status !== 'accepted' && status !== 'denied')) {
      return c.json({ error: 'status must be accepted or denied' }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    const [updated] = await db
      .update(friendships)
      .set({ status })
      .where(and(eq(friendships.id, id), eq(friendships.addresseeId, currentUser.id), eq(friendships.status, 'pending')))
      .returning();

    if (!updated) {
      return c.json({ error: 'Friendship request not found' }, 404);
    }

    return c.json(updated);
  })
  .delete('/:id', requireAuth, async (c) => {
    const currentUser = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid friendship id' }, 400);

    const db = createDb(c.env.DATABASE_URL);
    const [deleted] = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, id),
          or(
            and(eq(friendships.status, 'pending'), eq(friendships.requesterId, currentUser.id)),
            and(eq(friendships.status, 'accepted'), or(eq(friendships.requesterId, currentUser.id), eq(friendships.addresseeId, currentUser.id))),
          ),
        ),
      )
      .returning();

    if (!deleted) {
      return c.json({ error: 'Friendship not found' }, 404);
    }

    return c.json(deleted);
  });
