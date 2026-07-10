import { describe, expect, it } from 'bun:test';
import { getAvatarColor, getAvatarInitial } from './avatar';

describe('getAvatarInitial', () => {
  it('先頭文字を大文字化して返す', () => {
    expect(getAvatarInitial('Alice')).toBe('A');
    expect(getAvatarInitial('alice')).toBe('A');
  });

  it('前後の空白を trim する', () => {
    expect(getAvatarInitial('  Bob  ')).toBe('B');
  });

  it('空文字・空白・null・undefined は ? を返す', () => {
    expect(getAvatarInitial('')).toBe('?');
    expect(getAvatarInitial('   ')).toBe('?');
    expect(getAvatarInitial(null)).toBe('?');
    expect(getAvatarInitial(undefined)).toBe('?');
  });
});

describe('getAvatarColor', () => {
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];

  it('同じ名前は同じ色を返す', () => {
    expect(getAvatarColor('Alice')).toBe(getAvatarColor('Alice'));
  });

  it('既存色配列のいずれかを返す', () => {
    expect(colors).toContain(getAvatarColor('Alice'));
    expect(colors).toContain(getAvatarColor('Bob'));
  });

  it('空文字・空白・null・undefined は #333 を返す', () => {
    expect(getAvatarColor('')).toBe('#333');
    expect(getAvatarColor('   ')).toBe('#333');
    expect(getAvatarColor(null)).toBe('#333');
    expect(getAvatarColor(undefined)).toBe('#333');
  });
});
