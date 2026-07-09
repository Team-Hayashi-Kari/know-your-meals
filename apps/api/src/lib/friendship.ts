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
