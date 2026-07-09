import { posts } from '@repo/db';
import { friendshipPairCondition } from './friendship';

/** 投稿の閲覧者（userId）と投稿者（posts.userId）が友達関係（双方向どちらの向きでも）にあるかを判定する join 条件 */
export const postFriendshipCondition = (userId: string) => friendshipPairCondition(userId, posts.userId);
