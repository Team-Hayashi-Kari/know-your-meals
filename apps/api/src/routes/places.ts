import { Hono } from 'hono';
import { searchPlaces } from '../lib/places';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

export const places = new Hono<Env>().get('/search', requireAuth, async (c) => {
  const q = c.req.query('q') ?? '';
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  if (!latStr || !lngStr) return c.json({ error: 'lat and lng are required' }, 400);
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ error: 'lat and lng are required' }, 400);
  }
  try {
    const results = await searchPlaces(c.env.GOOGLE_PLACES_API_KEY, { query: q, lat, lng });
    return c.json({ places: results });
  } catch {
    return c.json({ error: 'Places search failed' }, 502);
  }
});
