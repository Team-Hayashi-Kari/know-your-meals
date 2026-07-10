import { createDb, shops } from '@repo/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getPlaceDetails } from '../lib/places';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

export const shopsRoute = new Hono<Env>().get('/:googlePlaceId', requireAuth, async (c) => {
  const googlePlaceId = c.req.param('googlePlaceId');
  const db = createDb(c.env.DATABASE_URL);
  const shopColumns = { id: shops.id, googlePlaceId: shops.googlePlaceId, name: shops.name, address: shops.address, lat: shops.lat, lng: shops.lng };

  const [cached] = await db.select(shopColumns).from(shops).where(eq(shops.googlePlaceId, googlePlaceId));
  if (cached) return c.json({ shop: cached });

  let place: Awaited<ReturnType<typeof getPlaceDetails>>;
  try {
    place = await getPlaceDetails(c.env.GOOGLE_PLACES_API_KEY, googlePlaceId);
  } catch {
    return c.json({ error: 'Place details failed' }, 502);
  }
  if (!place) return c.json({ error: 'Shop not found' }, 404);

  let upserted: (typeof shops.$inferSelect)[];
  try {
    upserted = await db
      .insert(shops)
      .values({
        googlePlaceId: place.placeId,
        name: place.name,
        address: place.address || null,
        lat: place.location.lat,
        lng: place.location.lng,
      })
      .onConflictDoUpdate({
        target: shops.googlePlaceId,
        set: { name: place.name, address: place.address || null, lat: place.location.lat, lng: place.location.lng },
      })
      .returning();
  } catch {
    return c.json({ error: 'Failed to save shop' }, 500);
  }
  const shop = upserted[0];
  if (!shop) return c.json({ error: 'Failed to save shop' }, 500);

  return c.json({
    shop: { id: shop.id, googlePlaceId: shop.googlePlaceId, name: shop.name, address: shop.address, lat: shop.lat, lng: shop.lng },
  });
});
