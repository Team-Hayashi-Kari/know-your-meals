// 投稿フロー（撮影→店舗選択→投稿作成）で撮影/選択した画像・選択した店舗を画面間で受け渡すための下書きステート。
// POST /api/posts はmultipartで画像本体(File/Blob)を要求するため、URIだけでなくBlobも保持する。

export type DraftStore = {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
};

export type PostDraft = {
  imageBlob: Blob | null;
  imageUri: string | null;
  store: DraftStore | null;
};

let draft: PostDraft = { imageBlob: null, imageUri: null, store: null };

export function setDraftImage(blob: Blob, uri: string) {
  draft = { ...draft, imageBlob: blob, imageUri: uri };
}

export function setDraftStore(store: DraftStore) {
  draft = { ...draft, store };
}

export function getDraft(): PostDraft {
  return draft;
}

export function clearDraft() {
  draft = { imageBlob: null, imageUri: null, store: null };
}
