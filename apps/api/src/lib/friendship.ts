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

/** フロント表示用の relationshipStatus。DB の friendships.status とは別物 */
export type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

type FriendshipRow = { id: number; status: string; requesterId: string; addresseeId: string };

/** friendships 行を currentUserId から見た relationshipStatus / friendshipId に変換する */
export function deriveRelationship(
  row: FriendshipRow | undefined,
  currentUserId: string,
): { relationshipStatus: RelationshipStatus; friendshipId: number | null } {
  if (!row || row.status === 'denied') return { relationshipStatus: 'none', friendshipId: null };
  if (row.status === 'accepted') return { relationshipStatus: 'friends', friendshipId: row.id };
  return { relationshipStatus: row.requesterId === currentUserId ? 'pending_sent' : 'pending_received', friendshipId: row.id };
}
