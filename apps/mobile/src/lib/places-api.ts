// GET /api/places/search（Googleプロキシ）を直接呼び出すクライアント。要認証（cookieセッション、credentials: 'include'）。

export type PlaceResult = {
  name: string;
  address: string;
  location: { lat: number; lng: number };
  placeId: string;
  photos: string[];
};

export async function searchPlaces(query: string, lat: number, lng: number): Promise<PlaceResult[]> {
  const url = new URL('/api/places/search', process.env.EXPO_PUBLIC_API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));

  const response = await fetch(url.toString(), { credentials: 'include' });
  if (!response.ok) throw new Error(`Places search failed: ${response.status}`);

  const data = (await response.json()) as { places: PlaceResult[] };
  return data.places;
}

// 2点間の距離をメートルで返す（ハーバーサイン公式）
export function distanceInMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
