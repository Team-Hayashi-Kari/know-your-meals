import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { images, posts, shops } from './content';

export const friendshipStatusEnum = pgEnum('friendship_status', ['pending', 'accepted', 'denied']);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('bookmarks_user_post_idx').on(table.userId, table.postId)],
);

export const friendships = pgTable(
  'friendships',
  {
    id: serial('id').primaryKey(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    addresseeId: text('addressee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('friendships_user_pair_idx').on(
      sql`LEAST(${table.requesterId}, ${table.addresseeId})`,
      sql`GREATEST(${table.requesterId}, ${table.addresseeId})`,
    ),
    index('friendships_addressee_id_idx').on(table.addresseeId),
    index('friendships_requester_id_idx').on(table.requesterId),
    check('friendships_no_self_check', sql`${table.requesterId} <> ${table.addresseeId}`),
  ],
);

// postsRelations は bookmarks を参照するためここで定義
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(user, { fields: [posts.userId], references: [user.id] }),
  shop: one(shops, { fields: [posts.shopId], references: [shops.id] }),
  bookmarks: many(bookmarks),
  image: one(images),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(user, { fields: [bookmarks.userId], references: [user.id] }),
  post: one(posts, { fields: [bookmarks.postId], references: [posts.id] }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(user, {
    fields: [friendships.requesterId],
    references: [user.id],
    relationName: 'requester',
  }),
  addressee: one(user, {
    fields: [friendships.addresseeId],
    references: [user.id],
    relationName: 'addressee',
  }),
}));
