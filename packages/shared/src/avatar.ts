const AVATAR_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];
const AVATAR_FALLBACK_COLOR = '#333';

export function getAvatarInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function getAvatarColor(name: string | null | undefined): string {
  const value = name ?? '';
  if (!value.trim()) return AVATAR_FALLBACK_COLOR;
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    sum += value.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_FALLBACK_COLOR;
}
