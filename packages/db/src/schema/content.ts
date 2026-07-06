import { relations } from 'drizzle-orm';
import { doublePrecision, index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const pinEmojiEnum = pgEnum('pin_emoji', ['🍜', '🍣', '🍛', '🍙', '🍔', '🍕', '🥩', '🍰', '🍺', '🥟']);

export const shops = pgTable(
  'shops',
  {
    id: serial('id').primaryKey(),
    googlePlaceId: text('google_place_id').notNull().unique(),
    name: text('name').notNull(),
    address: text('address'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('shops_lat_lng_idx').on(table.lat, table.lng)],
);

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    imageURL: text('image_url').notNull(),
    comment: text('comment'),
    pin: pinEmojiEnum('pin').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('posts_user_id_idx').on(table.userId), index('posts_shop_id_idx').on(table.shopId)],
);

export const shopsRelations = relations(shops, ({ many }) => ({
  posts: many(posts),
}));
