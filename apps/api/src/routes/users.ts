import { createDb, user } from '@repo/db';
import { and, asc, count, ilike, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 50;

export const usersRoute = new Hono<Env>().get('/search', requireAuth, async (c) => {
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

  const countResult = await db.select({ total: count() }).from(user).where(where);
  const total = countResult[0]?.total ?? 0;
  const users = await db
    .select({ id: user.id, name: user.name, handle: user.handle, image: user.image })
    .from(user)
    .where(where)
    .orderBy(asc(user.name), asc(user.id))
    .limit(limit)
    .offset((page - 1) * limit);

  const hasMore = page * limit < total;

  return c.json({ users, nextPage: hasMore ? page + 1 : null });
});
