import { posts } from '@repo/db';
import { friendshipPairCondition as friendshipPairConditionBase } from './friendship';

/** userId と posts.userId が友達関係（双方向どちらの向きでも）にあるかを判定する join 条件 */
export const friendshipPairCondition = (userId: string) => friendshipPairConditionBase(userId, posts.userId);
