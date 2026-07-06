import { relations } from 'drizzle-orm';
import { doublePrecision, index, integer, pgEnum, pgTable, serial, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const pinEmojiEnum = pgEnum('pin_emoji', ['🍜', '🍣', '🍛', '🍙', '🍔', '🍕', '🥩', '🍰', '🍺', '🥟']);
export const imageStatusEnum = pgEnum('image_status', ['pending', 'attached']);

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

export const images = pgTable('images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  status: imageStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [index('images_user_id_idx').on(table.userId)]);

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
    imageId: uuid('image_id')
      .notNull()
      .references(() => images.id, { onDelete: 'restrict' }),
    comment: text('comment'),
    pin: pinEmojiEnum('pin').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('posts_user_id_idx').on(table.userId),
    index('posts_shop_id_idx').on(table.shopId),
    uniqueIndex('posts_image_id_unique').on(table.imageId),
  ],

);

export const shopsRelations = relations(shops, ({ many }) => ({
  posts: many(posts),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(user, { fields: [images.userId], references: [user.id] }),
  post: one(posts, { fields: [images.id], references: [posts.imageId] }),
}));
