import type { createDb } from '@repo/db';
import { friendships } from '@repo/db';
import { and, eq, or } from 'drizzle-orm';

export async function isFriend(db: ReturnType<typeof createDb>, userId1: string, userId2: string): Promise<boolean> {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(eq(friendships.requesterId, userId1), eq(friendships.addresseeId, userId2)),
          and(eq(friendships.requesterId, userId2), eq(friendships.addresseeId, userId1)),
        ),
      ),
    )
    .limit(1);
  return !!row;
}
