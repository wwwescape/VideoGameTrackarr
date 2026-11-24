// Loads pdf.js (the legacy build, for older browsers and TV WebViews) and its viewer layer on
// first use. The viewer reads the library from globalThis.pdfjsLib when it's evaluated, so the
// library is imported and published first; both land in the lazily-loaded "pdfjs" chunk.

type PdfjsLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfjsViewer = typeof import("pdfjs-dist/legacy/web/pdf_viewer.mjs");

export interface Pdfjs {
  lib: PdfjsLib;
  viewer: PdfjsViewer;
}

// pdf.js's data files, copied into public/pdfjs/ by scripts/vendor-pdfjs.mjs.
const DATA_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export const PDFJS_DATA = {
  standardFontDataUrl: `${DATA_BASE}standard_fonts/`,
  cMapUrl: `${DATA_BASE}cmaps/`,
  wasmUrl: `${DATA_BASE}wasm/`,
  iccUrl: `${DATA_BASE}iccs/`,
};

let loading: Promise<Pdfjs> | null = null;

export function loadPdfjs(): Promise<Pdfjs> {
  loading ??= (async () => {
    const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { default: workerUrl } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    (globalThis as { pdfjsLib?: PdfjsLib }).pdfjsLib = lib;
    const viewer = await import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
    await import("pdfjs-dist/legacy/web/pdf_viewer.css");
    return { lib, viewer };
  })().catch((error: unknown) => {
    // Let a later open try again (a flaky connection while the chunk loaded).
    loading = null;
    throw error;
  });
  return loading;
}
