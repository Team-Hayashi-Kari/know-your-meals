// Wrangler のバンドラーは `.wasm` import を `WebAssembly.Module` に、`.woff2` import を
//（wrangler.toml の `Data` module rule により）`ArrayBuffer` にコンパイルする。
// `bun test` ではどちらもファイルパス文字列として解決される
//（ランタイム側の吸収処理は default-avatar.ts の toWasmModule/toBytes を参照）。
declare module '*.wasm' {
  const value: string | WebAssembly.Module;
  export default value;
}

declare module '*.woff2' {
  const value: string | ArrayBuffer;
  export default value;
}

// このリポジトリは `lib: ["ESNext"]`（"dom" なし）のため、@jsquash/jpeg の公開APIの型は
// ブラウザの ImageData 型を前提にしているが、そのままでは解決できない。
declare global {
  interface ImageData {
    data: Uint8ClampedArray | Uint8Array;
    width: number;
    height: number;
  }
}
