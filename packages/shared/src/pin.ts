// 投稿の地図ピンとして選択できる絵文字10種。packages/db の pinEmojiEnum はこの配列から生成される。
export const PIN_EMOJIS = ['🍜', '🍣', '🍛', '🍙', '🍔', '🍕', '🥩', '🍰', '🍺', '🥟'] as const;

export type PinEmoji = (typeof PIN_EMOJIS)[number];
