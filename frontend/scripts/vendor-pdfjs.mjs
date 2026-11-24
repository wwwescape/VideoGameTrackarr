// Copies pdf.js's data files (Apache-2.0) from node_modules/pdfjs-dist into public/pdfjs/, so
// the Guides & Cheats reader loads them from this origin: standard_fonts/ (PDFs that use the
// 14 standard fonts without embedding them), cmaps/ (Chinese, Japanese and Korean text),
// wasm/ (JPEG 2000 and other image decoders) and iccs/ (colour profiles). The library itself
// is an ordinary dependency bundled by Vite; only these loose files need copying. Runs before
// `npm run start` and `npm run build` (prestart/prebuild), like vendor-emulatorjs.mjs. The
// output folder is gitignored.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "public", "pdfjs");
const require = createRequire(import.meta.url);
const packageJson = require.resolve("pdfjs-dist/package.json");
const source = dirname(packageJson);
const { version } = JSON.parse(readFileSync(packageJson, "utf8"));
const FOLDERS = ["standard_fonts", "cmaps", "wasm", "iccs"];
const stamp = join(target, ".version");

if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === version) {
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const folder of FOLDERS) {
  const from = join(source, folder);
  if (!existsSync(from)) {
    throw new Error(`pdfjs-dist ${version} has no ${folder}/ folder`);
  }
  cpSync(from, join(target, folder), { recursive: true });
}
writeFileSync(stamp, `${version}\n`);
console.log(`Vendored pdf.js ${version} data files into public/pdfjs/`);
