import { friendships, posts } from '@repo/db';
import { and, eq, or } from 'drizzle-orm';

/** userId と posts.userId が友達関係（双方向どちらの向きでも）にあるかを判定する join 条件 */
export const friendshipPairCondition = (userId: string) =>
  or(
    and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, posts.userId)),
    and(eq(friendships.requesterId, posts.userId), eq(friendships.addresseeId, userId)),
  );
