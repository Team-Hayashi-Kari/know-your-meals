import jpegEncoderWasmAsset from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
import encodeJpeg, { init as initJpegEncoder } from '@jsquash/jpeg/encode.js';
import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { initWasm as initResvg, Resvg } from '@resvg/resvg-wasm';
import resvgWasmAsset from '@resvg/resvg-wasm/index_bg.wasm';
import { Hono } from 'hono';
import fontAsset from '../assets/inter-bold-latin.woff2';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types';

const SIZE = 128;
const FONT_FAMILY = 'Inter';

// Wrangler は `.wasm`/`.woff2` の import をそのまま WebAssembly.Module / ArrayBuffer にバンドルするが、
// `bun test` では同じ import がディスク上のファイルパス文字列として解決される。
// Wrangler・`bun test` どちらでも動くよう、両方の形を吸収する。
async function toWasmModule(asset: string | WebAssembly.Module): Promise<WebAssembly.Module> {
  if (asset instanceof WebAssembly.Module) return asset;
  const bytes = await Bun.file(asset).arrayBuffer();
  return WebAssembly.compile(bytes);
}

async function toBytes(asset: string | ArrayBuffer): Promise<Uint8Array> {
  if (typeof asset === 'string') return new Uint8Array(await Bun.file(asset).arrayBuffer());
  return new Uint8Array(asset);
}

let initPromise: Promise<Uint8Array> | undefined;

// 2つの wasm コーデックはプロセス全体で1回だけ初期化する。リクエストごとに初期化すると
// 毎回 wasm モジュールを再コンパイルすることになり、無駄にコストが高い。
function ensureInit(): Promise<Uint8Array> {
  if (!initPromise) {
    initPromise = Promise.all([
      toWasmModule(resvgWasmAsset).then(initResvg),
      toWasmModule(jpegEncoderWasmAsset).then(initJpegEncoder),
      toBytes(fontAsset),
    ])
      .then(([, , fontBytes]) => fontBytes)
      .catch((error) => {
        initPromise = undefined;
        throw error;
      });
  }
  return initPromise;
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// 同梱フォントは Latin の英数字のみ対応（assets/inter-LICENSE.txt 参照）。対応外の文字
// （日本語の頭文字など）を描画させると resvg が .notdef グリフにフォールバックし、
// 何も描画されないのではなく崩れた四角が描画されてしまう。そのため対応外の頭文字は
// 描画自体をスキップし、背景色のみの正方形にフォールバックする。
const RENDERABLE_INITIAL = /^[A-Za-z0-9?]$/;

function buildSvg(initial: string, backgroundColor: string): string {
  const text = RENDERABLE_INITIAL.test(initial)
    ? `<text x="${SIZE / 2}" y="${SIZE / 2}" font-family="${FONT_FAMILY}" font-weight="700" font-size="${SIZE / 2}" fill="#fff" text-anchor="middle" dominant-baseline="central">${escapeXmlText(initial)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${backgroundColor}"/>
  ${text}
</svg>`;
}

export const defaultAvatarRoute = new Hono<Env>().get('/', requireAuth, async (c) => {
  const name = c.req.query('name');
  const initial = getAvatarInitial(name);
  const backgroundColor = getAvatarColor(name);

  const fontBytes = await ensureInit();

  const svg = buildSvg(initial, backgroundColor);
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontBuffers: [fontBytes],
      defaultFontFamily: FONT_FAMILY,
    },
  });
  const rendered = resvg.render();
  const jpegBuffer = await encodeJpeg({ data: rendered.pixels, width: rendered.width, height: rendered.height }, { quality: 80 });

  return new Response(jpegBuffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
