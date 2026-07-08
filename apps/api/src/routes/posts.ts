import { createDb, images, pinEmojiEnum, posts, shops } from '@repo/db';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

const PIN_EMOJIS = pinEmojiEnum.enumValues;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

// magic bytes → MIME allowlist（クライアントのContent-Typeは信頼しない）
const MAGIC: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
];

const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MARK = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

const sniffMime = (buf: Uint8Array): string | null => {
  for (const { bytes, mime } of MAGIC) {
    if (bytes.every((b, i) => buf[i] === b)) return mime;
  }
  // WebP: bytes[0-3]="RIFF", bytes[4-7]=filesize(skip), bytes[8-11]="WEBP"
  if (WEBP_RIFF.every((b, i) => buf[i] === b) && WEBP_MARK.every((b, i) => buf[8 + i] === b)) {
    return 'image/webp';
  }
  return null;
};

type ShopInput = {
  googlePlaceId: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
};

export const postsRoute = new Hono<Env>().post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.parseBody();

  const shopRaw = body.shop;
  const comment = typeof body.comment === 'string' ? body.comment : undefined;
  const pin = body.pin;
  const imageFile = body.image;

  if (!shopRaw || typeof shopRaw !== 'string') {
    return c.json({ error: 'shop is required' }, 400);
  }
  if (!pin || typeof pin !== 'string' || !(PIN_EMOJIS as readonly string[]).includes(pin)) {
    return c.json({ error: `pin must be one of: ${PIN_EMOJIS.join(' ')}` }, 400);
  }
  if (!imageFile || !(imageFile instanceof File)) {
    return c.json({ error: 'image is required' }, 400);
  }

  let shop: ShopInput;
  try {
    shop = JSON.parse(shopRaw) as ShopInput;
    if (!shop.googlePlaceId || !shop.name || !Number.isFinite(shop.lat) || !Number.isFinite(shop.lng)) throw new Error();
  } catch {
    return c.json({ error: 'shop must be valid JSON with googlePlaceId, name, lat, lng' }, 400);
  }

  if (imageFile.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'Image exceeds 10MB limit' }, 413);
  }

  const db = createDb(c.env.DATABASE_URL);

  const upsertedShops = await db
    .insert(shops)
    .values({
      googlePlaceId: shop.googlePlaceId,
      name: shop.name,
      address: shop.address ?? null,
      lat: shop.lat,
      lng: shop.lng,
    })
    .onConflictDoUpdate({
      target: shops.googlePlaceId,
      set: { name: shop.name, address: shop.address ?? null, lat: shop.lat, lng: shop.lng },
    })
    .returning();
  const upsertedShop = upsertedShops[0];
  if (!upsertedShop) return c.json({ error: 'Failed to upsert shop' }, 500);

  const key = `${user.id}/${crypto.randomUUID()}`;
  const arrayBuffer = await imageFile.arrayBuffer();
  const contentType = sniffMime(new Uint8Array(arrayBuffer));
  if (!contentType) return c.json({ error: 'Unsupported image format. Use JPEG, PNG, or WebP.' }, 400);
  await c.env.IMAGES_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType },
  });

  let post: typeof posts.$inferSelect;
  let image: typeof images.$inferSelect;
  try {
    const createdPosts = await db
      .insert(posts)
      .values({
        userId: user.id,
        shopId: upsertedShop.id,
        comment: comment ?? null,
        pin: pin as (typeof PIN_EMOJIS)[number],
      })
      .returning();
    if (!createdPosts[0]) throw new Error('Failed to create post');
    post = createdPosts[0];

    const createdImages = await db.insert(images).values({ postId: post.id, key }).returning();
    if (!createdImages[0]) throw new Error('Failed to create image record');
    image = createdImages[0];
  } catch {
    await c.env.IMAGES_BUCKET.delete(key);
    return c.json({ error: 'Failed to save post' }, 500);
  }

  const imageUrl = `${c.env.IMAGES_BASE_URL}/${key}`;

  return c.json({
    post: {
      id: post.id,
      comment: post.comment,
      pin: post.pin,
      createdAt: post.createdAt,
      shop: {
        id: upsertedShop.id,
        googlePlaceId: upsertedShop.googlePlaceId,
        name: upsertedShop.name,
        address: upsertedShop.address,
        lat: upsertedShop.lat,
        lng: upsertedShop.lng,
      },
      image: {
        id: image.id,
        url: imageUrl,
      },
    },
  });
});
