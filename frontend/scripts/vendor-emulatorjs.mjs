// Vendors EmulatorJS (GPL-3.0) and the bundled emulator cores into public/emulatorjs/data/,
// so Vite serves them in dev and copies them into build/ for production — self-hosted,
// never loaded from EmulatorJS's CDN. Runs automatically before `npm run start` and
// `npm run build` (prestart/prebuild in package.json), including inside the Docker
// frontend-builder stage. The output folder is gitignored; nothing binary is committed.
//
// Why not plain npm dependencies: @emulatorjs/emulatorjs declares its own build tooling
// (http-server, socket.io, minifiers) as runtime dependencies and every core as an optional
// dependency pinned to "latest" — ~300 MB and ~1,500 lockfile lines for the two cores this
// app actually ships. Instead, the exact tarballs below are downloaded from the npm registry,
// verified against their published sha512 integrity hashes, and cached locally.
//
// PACKAGES' cores must stay in sync with backend/app/services/emulation_cores.py's CORES —
// a core listed there but missing here makes EmulatorJS fall back to fetching it from its
// CDN. To add one: `npm view @emulatorjs/core-<name>@<version> dist.integrity`.

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const EJS_VERSION = "4.2.3";
const PACKAGES = [
  {
    name: "@emulatorjs/emulatorjs",
    integrity:
      "sha512-7z3qaA4LwyurhuGvdMUDF9xJpEbxC3SNy9+E9tSaOsRo8FCS2QXam/0k/lc9kqHWRFIlLKWahNjPAStyL0rFnw==",
  },
  {
    name: "@emulatorjs/core-fceumm",
    core: "fceumm",
    integrity:
      "sha512-XX9Vv2N/hzp0TstNMCTSppEs+sg+1lpJpPdSDuRqIO/cwdt7dUcF+WjNX1yQJLRbP5+XwcNHZ6K4BKy8CJpndQ==",
  },
  {
    name: "@emulatorjs/core-mgba",
    core: "mgba",
    integrity:
      "sha512-daiHzZQKEr+P9fra7j5YoEAXiyYUEtBhFQ8EAV/SeCtrkvqtayU7GQ9LYgoSgzkKSwsbNSskApqGuA9EGARYPA==",
  },
  {
    name: "@emulatorjs/core-snes9x",
    core: "snes9x",
    integrity:
      "sha512-JTe9Rv9eOuCkgkG4ILwuCZUqNcVI3m9ju1NHTTjridUlFgJSqL4DUqF/vLKN9olCpsqlJFfcCayAOoikJxefwA==",
  },
  {
    name: "@emulatorjs/core-gambatte",
    core: "gambatte",
    integrity:
      "sha512-Oq3AJL9SKnMsNAmtAP2eN934TQts3NHeaAe0z1BO9Lx/L3xDZKLpxL+XwgcSXIrl4Sx1oXxYEUwD7JjPEQ0DGg==",
  },
  {
    name: "@emulatorjs/core-mupen64plus_next",
    core: "mupen64plus_next",
    integrity:
      "sha512-HnnEXbOEpYxD7f2wUJQLxWUpEB0bT2kC56u5s7PLyj/xNI5ckQKka5+ay1QhU2fOv2BuPRwjjhlzmVJmk5e3hw==",
  },
  {
    name: "@emulatorjs/core-melonds",
    core: "melonds",
    integrity:
      "sha512-IjsEBNLPPbqU2GSeWEoEkOgAonK3JEyzvoYR3ucgOXu6InzDNdfuA5kP/mMh3d6DwCUbOwfnqGZuZXMTyNE2wA==",
  },
  {
    name: "@emulatorjs/core-beetle_vb",
    core: "beetle_vb",
    integrity:
      "sha512-/e6qkA/spYw27qDmzxMiMW5ic36N5W1AVU3Qki8BTZGWKXDseZtNuV/zlPts9rwtTuH8k4+fsQLF+dHp905+/Q==",
  },
  {
    name: "@emulatorjs/core-genesis_plus_gx",
    core: "genesis_plus_gx",
    integrity:
      "sha512-D1e2XA2CPRAjfr0JurpXJgR9dePxl/xHtaE8v1T9BqD9A3DLfobIFWsWU9jCFS4NfUxCvcLdTYdY/We3QzvcTw==",
  },
  {
    name: "@emulatorjs/core-picodrive",
    core: "picodrive",
    integrity:
      "sha512-FUxeHeJIIKi4XG+UdOoCARDjH7hV11XLb6LFUO644F7Ri08veGqMQkOJAoCP8uXGxa/JdgS7SXqc0a40+vLv2w==",
  },
  {
    name: "@emulatorjs/core-stella2014",
    core: "stella2014",
    integrity:
      "sha512-bs5az26pMrM6jswhZ5YxBXLpIwclwfdnWVbaEpip7yjJFQHactL7KYH7hVLts0JWDnfEK2lNxh4zlTfI6HAHmQ==",
  },
  {
    name: "@emulatorjs/core-prosystem",
    core: "prosystem",
    integrity:
      "sha512-Dd+gkjtXzzO4vNRKh1AtwUL8iKveQgz3Oy+ENx7uUvpUYAoQc/UT5aDfKP5vwgJJOg6ErwDH1ShC0WW100YvZQ==",
  },
  {
    name: "@emulatorjs/core-virtualjaguar",
    core: "virtualjaguar",
    integrity:
      "sha512-aZ5oWVrLrXwyVByK11jgcrcdqKM4MfhDucucuBk4duO2blHB8TS8f1XYUDbz0/N44Wl5+sphc5U5IaiXgvdFQw==",
  },
  {
    name: "@emulatorjs/core-mednafen_pce",
    core: "mednafen_pce",
    integrity:
      "sha512-PwnQAKKxWT8m8dUscH4VX8jcClvgxgR/NkE6FxNE8qiRDyBH3Jze7+tF9+UdWLoJRBwssR5knd7o/Es9xIlU6A==",
  },
  {
    name: "@emulatorjs/core-mednafen_ngp",
    core: "mednafen_ngp",
    integrity:
      "sha512-q/BhrhIk1+yGQ8zXPHaRXMm7Bqgu+7RkRTwbnUSlH3E/ybj8npA3SOP8tvA8TK2ceZU2F5pWdDAwp3dzR3iikg==",
  },
  {
    name: "@emulatorjs/core-mednafen_wswan",
    core: "mednafen_wswan",
    integrity:
      "sha512-ePj0OoSTErXS171PCUsiZl3OrfPJVwupvRYFiMSzu6K2UaQjK3ESThWf8Rh1niJt1F1OQyjQENAeElSm0IcojQ==",
  },
  {
    name: "@emulatorjs/core-pcsx_rearmed",
    core: "pcsx_rearmed",
    integrity:
      "sha512-mMbl/NszCryFI15X5QniOqLNL7YGZ6tLP24gr5y1q2ekFOIbtc39BcVTMDEwRndNGovh2nPoCcMjB+W3fgQCog==",
  },
  {
    name: "@emulatorjs/core-opera",
    core: "opera",
    integrity:
      "sha512-cJSZXUAtHF2DLznDEFfo5Owuc9YQh5pg1qCb1TDhtkDZ4Q4za1dTIM0WZYbARd7IN83OX1UB2wd03BSDmCQAFQ==",
  },
  {
    name: "@emulatorjs/core-handy",
    core: "handy",
    integrity:
      "sha512-miv2nSSVIIHFcGeEdeO7BpYKsljL1j+0an4BO7xw44s9iUp2PZnHiY1mHWUIOzf4o22VuiXd/TvHOKUGaEYMNw==",
  },
  {
    name: "@emulatorjs/core-a5200",
    core: "a5200",
    integrity:
      "sha512-/9yS0/MKHp/wO9iuxWfWTGUwiVNKykEOb7fEN5UM9BfIVQ1SAqep4Ji+TigmYW4weH/mASvYzON9ett3dmD6oQ==",
  },
  {
    name: "@emulatorjs/core-gearcoleco",
    core: "gearcoleco",
    integrity:
      "sha512-todwg9FhUzIBe1xkut+HOKmXvwIHgLSNKwERJm2yfJMY7gx/S1MHITHWWUHL3qxSmApacEucr9nZfpuTqVcjpA==",
  },
  {
    name: "@emulatorjs/core-yabause",
    core: "yabause",
    integrity:
      "sha512-12JwbgwoS1l4+KbsQ0jcIU71jVhn5XgXN80/1Fc8aZE4i4sEQatYKU3dZSMBlIJZaWgRN76PEjQymASMJA9/4w==",
  },
  {
    name: "@emulatorjs/core-dosbox_pure",
    core: "dosbox_pure",
    threads: true,
    integrity:
      "sha512-48CT0ztvnh/M+NRLtHS+pSysdnvH+p+6tgMLJU3+jvfPXdX1dlksiq8PvHPwtpuEF3d9mt2yECCBY9Vq6nkgdw==",
  },
  {
    name: "@emulatorjs/core-ppsspp",
    core: "ppsspp",
    threads: true,
    integrity:
      "sha512-jSCvK+74PYFwpqbEWzAkuDalK1TQXYogVXUxs24wn0SJcMhykQuziNggn4QQgM7+4wy60Jkh0Xb00PM9fLlWvA==",
  },
];

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(frontendDir, "public", "emulatorjs", "data");
const cacheDir = join(frontendDir, "node_modules", ".cache", "vgt-emulatorjs");

function tarballUrl(name) {
  const basename = name.split("/")[1];
  return `https://registry.npmjs.org/${name}/-/${basename}-${EJS_VERSION}.tgz`;
}

function verify(buffer, integrity, label) {
  const [algorithm, expected] = integrity.split("-", 2);
  const actual = createHash(algorithm).update(buffer).digest("base64");
  if (actual !== expected) {
    throw new Error(`vendor-emulatorjs: integrity mismatch for ${label} (expected ${integrity})`);
  }
}

async function fetchTarball(pkg) {
  const cached = join(cacheDir, `${pkg.name.replace("/", "__")}-${EJS_VERSION}.tgz`);
  if (existsSync(cached)) {
    const buffer = readFileSync(cached);
    try {
      verify(buffer, pkg.integrity, pkg.name);
      return buffer;
    } catch {
      rmSync(cached, { force: true });
    }
  }
  const response = await fetch(tarballUrl(pkg.name));
  if (!response.ok) {
    throw new Error(`vendor-emulatorjs: downloading ${pkg.name} failed (HTTP ${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  verify(buffer, pkg.integrity, pkg.name);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cached, buffer);
  return buffer;
}

// Minimal ustar reader — enough for npm package tarballs (regular files + directories, with
// optional pax headers), so this script needs no dependencies or system `tar`.
function extractTarball(tgz, destination) {
  const tar = gunzipSync(tgz);
  const root = resolve(destination);
  let offset = 0;
  let paxPath = null;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) =>
      header
        .subarray(start, start + length)
        .toString("utf8")
        .replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1) || "0";
    const prefix = field(345, 155);
    const name = paxPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    const body = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === "x") {
      const match = body.toString("utf8").match(/\d+ path=([^\n]*)\n/);
      paxPath = match ? match[1] : null;
      continue;
    }
    paxPath = null;
    if (type !== "0" && type !== "5") continue;

    // npm tarballs put everything under package/ — strip it, and refuse anything that would
    // land outside the destination.
    const relative = name.replace(/^package\//, "");
    const target = resolve(root, normalize(relative));
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`vendor-emulatorjs: refusing to extract ${name}`);
    }
    if (type === "5") {
      mkdirSync(target, { recursive: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }
}

async function main() {
  const workDir = join(cacheDir, `extracted-${EJS_VERSION}`);
  rmSync(workDir, { recursive: true, force: true });
  const extracted = {};
  for (const pkg of PACKAGES) {
    const dir = join(workDir, pkg.name.replace("/", "__"));
    extractTarball(await fetchTarball(pkg), dir);
    extracted[pkg.name] = dir;
  }

  const ejsDir = extracted["@emulatorjs/emulatorjs"];
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(ejsDir, "data"), outDir, { recursive: true });
  copyFileSync(join(ejsDir, "LICENSE"), join(outDir, "LICENSE"));
  // A package.json listing every core as a dependency — meaningless once vendored.
  rmSync(join(outDir, "cores", "package.json"), { force: true });

  // The npm package ships only EmulatorJS's unminified sources. loader.js asks for
  // emulator.min.js first and only falls back to data/src/*.js after a 404 (its alternative,
  // EJS_DEBUG_XX, pings cdn.emulatorjs.org for update checks on every load). Joining the
  // sources, in the exact order loader.js itself would load them, is behaviourally identical
  // to loading them one by one and avoids both.
  const loaderSource = readFileSync(join(outDir, "loader.js"), "utf8");
  const scriptList = loaderSource.match(/const scripts = \[([\s\S]*?)\]/);
  if (!scriptList) throw new Error("vendor-emulatorjs: couldn't find the script list in loader.js");
  const scripts = [...scriptList[1].matchAll(/"([^"]+\.js)"/g)].map((m) => m[1]);
  const bundle = scripts
    .map((file) => `/* ${file} */\n${readFileSync(join(outDir, "src", file), "utf8")}`)
    .join("\n;\n");
  writeFileSync(join(outDir, "emulator.min.js"), bundle);
  copyFileSync(join(outDir, "emulator.css"), join(outDir, "emulator.min.css"));

  const coreLines = [];
  mkdirSync(join(outDir, "cores", "reports"), { recursive: true });
  for (const pkg of PACKAGES.filter((p) => p.core)) {
    const coreDir = extracted[pkg.name];
    // Copy whichever builds the package ships. Threaded builds need SharedArrayBuffer, which
    // only the cross-origin-isolated player tab (player-isolated.html) has — so they're kept
    // only for cores that can't run without threads (DOSBox Pure, PPSSPP), whose packages
    // ship nothing else. PPSSPP also downloads its assets zip from cores/ at startup.
    const variants = readdirSync(coreDir).filter(
      (file) =>
        file.startsWith(`${pkg.core}-`) &&
        file.endsWith("-wasm.data") &&
        (pkg.threads || !file.includes("-thread"))
    );
    if (variants.length === 0) throw new Error(`vendor-emulatorjs: no usable build in ${pkg.name}`);
    for (const variant of variants) {
      copyFileSync(join(coreDir, variant), join(outDir, "cores", variant));
    }
    if (existsSync(join(coreDir, `${pkg.core}-assets.zip`))) {
      copyFileSync(join(coreDir, `${pkg.core}-assets.zip`), join(outDir, "cores", `${pkg.core}-assets.zip`));
    }
    copyFileSync(
      join(coreDir, "reports", `${pkg.core}.json`),
      join(outDir, "cores", "reports", `${pkg.core}.json`)
    );
    coreLines.push(`- \`${pkg.core}\` — ${pkg.name}@${EJS_VERSION}`);
  }
  rmSync(workDir, { recursive: true, force: true });

  writeFileSync(
    join(outDir, "VGT-VENDORED.md"),
    `# Vendored EmulatorJS

Generated by \`frontend/scripts/vendor-emulatorjs.mjs\` — do not edit by hand.

- EmulatorJS ${EJS_VERSION} (@emulatorjs/emulatorjs@${EJS_VERSION}), GPL-3.0 — see LICENSE in
  this folder. Unmodified upstream sources; source:
  https://github.com/EmulatorJS/EmulatorJS/tree/v${EJS_VERSION}
- \`emulator.min.js\`/\`emulator.min.css\` are the unmodified \`src/*.js\`/\`emulator.css\`
  files concatenated, not rewritten.

## Emulator cores

Each core is a separate libretro project under its own license — see the About page in
VideoGameTrackarr, or backend/app/services/emulation_cores.py, for each core's license and
upstream source.

${coreLines.join("\n")}
`
  );

  console.log(
    `vendor-emulatorjs: EmulatorJS ${EJS_VERSION} + cores [${coreLines.length}] -> ${outDir}`
  );
}

await main();
