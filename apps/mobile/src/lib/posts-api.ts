// POST /api/posts（画像込みmultipart）を直接呼び出すクライアント。要認証（cookieセッション、credentials: 'include'）。

export type CreatePostInput = {
  shop: { googlePlaceId: string; name: string; address: string; lat: number; lng: number };
  comment: string;
  pin: string;
  image: Blob;
};

export type CreatedPost = {
  id: number;
  comment: string | null;
  pin: string;
  createdAt: string;
  shop: { id: number; googlePlaceId: string; name: string; address: string | null; lat: number; lng: number };
  image: { id: number; url: string };
};

export async function createPost(input: CreatePostInput): Promise<CreatedPost> {
  const formData = new FormData();
  formData.append('shop', JSON.stringify(input.shop));
  formData.append('comment', input.comment);
  formData.append('pin', input.pin);
  formData.append('image', input.image, 'photo.jpg');

  const url = new URL('/api/posts', process.env.EXPO_PUBLIC_API_URL);
  const response = await fetch(url.toString(), { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error(`Post creation failed: ${response.status}`);

  const data = (await response.json()) as { post: CreatedPost };
  return data.post;
}
