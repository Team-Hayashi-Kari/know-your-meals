import type { createDb } from '@repo/db';
import { friendships } from '@repo/db';
import type { SQLWrapper } from 'drizzle-orm';
import { and, eq, or } from 'drizzle-orm';

type UserIdConditionValue = string | SQLWrapper;

/** 2ユーザーが友達関係（双方向どちらの向きでも）にあるかを判定する条件 */
export const friendshipPairCondition = (leftUserId: UserIdConditionValue, rightUserId: UserIdConditionValue) =>
  or(
    and(eq(friendships.requesterId, leftUserId), eq(friendships.addresseeId, rightUserId)),
    and(eq(friendships.requesterId, rightUserId), eq(friendships.addresseeId, leftUserId)),
  );

export async function isFriend(db: ReturnType<typeof createDb>, userId1: string, userId2: string): Promise<boolean> {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.status, 'accepted'), friendshipPairCondition(userId1, userId2)))
    .limit(1);
  return !!row;
}
