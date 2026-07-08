export type PlaceResult = {
  name: string;
  address: string;
  location: { lat: number; lng: number };
  placeId: string;
  photos: string[];
};

export async function searchPlaces(apiKey: string, params: { query: string; lat: number; lng: number }): Promise<PlaceResult[]> {
  const maxResultCount = 5;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id,places.photos',
    },
    body: JSON.stringify({
      textQuery: params.query || 'レストラン',
      locationBias: {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: 1500,
        },
      },
      maxResultCount: maxResultCount,
      languageCode: 'ja',
    }),
  });

  if (!response.ok) {
    throw new Error(`Places API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    places?: {
      displayName?: { text?: string };
      formattedAddress?: string;
      location: { latitude: number; longitude: number };
      id: string;
      photos?: { name: string }[];
    }[];
  };

  if (!data.places) return [];

  return data.places.map((p) => ({
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    location: { lat: p.location.latitude, lng: p.location.longitude },
    placeId: p.id,
    photos: (p.photos ?? []).map((x) => x.name),
  }));
}
