import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { PlatformResponse } from "../api/types";
import SpineIconGlyph from "./SpineIcon";

export interface ShelfGame {
  id: number;
  name: string;
  slug: string | null;
  uuid: string;
}

export interface ShelfCase {
  game: ShelfGame;
  platform: string;
}

export interface Shelf {
  platform: string;
  cases: ShelfCase[];
}

// Blank spine art is platform-based, not per-game: every case on a platform
// shares the platform's brand colours — matched on platform-name substrings,
// with a stable palette fallback.
const PLATFORM_SPINE_STYLES: { match: RegExp; background: string; color: string; height: number }[] = [
  { match: /switch/, background: "#f2f2f2", color: "#e60012", height: 158 },
  { match: /playstation|ps[1-5]|vita/, background: "#1b3a8f", color: "#ffffff", height: 176 },
  { match: /xbox/, background: "#107c10", color: "#ffffff", height: 176 },
  { match: /gamecube/, background: "#5b3ea8", color: "#ffffff", height: 168 },
  { match: /wii/, background: "#f5f5f5", color: "#3aa6dd", height: 176 },
  { match: /nintendo|nes|snes|n64|game boy|gameboy|ds|virtual/, background: "#8f1d22", color: "#ffffff", height: 190 },
  { match: /sega|genesis|dreamcast|saturn|master system/, background: "#17569b", color: "#ffffff", height: 182 },
  { match: /pc|windows|steam|dos/, background: "#2a475e", color: "#c7d5e0", height: 182 },
  { match: /atari|commodore|amiga|zx|arcade/, background: "#5a4632", color: "#f5e9d0", height: 190 },
];
const FALLBACK_PALETTE = ["#37474f", "#4e342e", "#283593", "#00695c", "#6a1b9a", "#ad1457", "#4527a0", "#2e7d32"];

export function spineStyle(platform: string, gameId: number) {
  const key = platform.toLowerCase();
  const matched = PLATFORM_SPINE_STYLES.find((entry) => entry.match.test(key));
  const width = 24 + (gameId % 14);
  if (matched) {
    return { background: matched.background, color: matched.color, height: matched.height, width };
  }
  return {
    background: FALLBACK_PALETTE[gameId % FALLBACK_PALETTE.length],
    color: "#ffffff",
    height: 176,
    width,
  };
}

// What the shelf measures from a template image when it loads: its natural
// pixel size (cases are scaled from it) and whether it's mostly white (the
// case title then prints black instead of white).
export interface TemplateInfo {
  naturalWidth: number;
  naturalHeight: number;
  light: boolean;
}

// Universal title band for EVERY spine, measured from a real Nintendo
// GameCube spine (Matthew's reference): the header block (console logo +
// wordmark + stripe) ends at 27.3% of the height, and the maker logo at the
// bottom starts at 95.1%. Titles print only between those zones — Matthew
// set the clearance to 30% at the top and 8% at the bottom — on generic and
// template spines alike.
export const TITLE_TOP_INSET = 0.3;
export const TITLE_BOTTOM_INSET = 0.08;

// Text-colour decision for template spines: sample ONLY the title band
// (the middle stretch where the title actually prints) and take the MEDIAN
// per-pixel luminance there. The old whole-image mean failed both ways — a
// bright banner/logo could drag a dark template to black text, and a dark
// banner could drag a white template under the threshold and leave white
// text on white. The median ignores the logo zones entirely, and 150 is
// the point where black text starts reading better than white.
export const LIGHT_TEXT_THRESHOLD = 150;
export function titleBandLight(rgba: ArrayLike<number>, width: number, height: number): boolean {
  const bandTop = Math.floor(height * 0.3);
  const bandBottom = Math.ceil(height * 0.92);
  const luminances: number[] = [];
  for (let y = bandTop; y < bandBottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      luminances.push((rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3);
    }
  }
  if (luminances.length === 0) return false;
  luminances.sort((a, b) => a - b);
  return luminances[Math.floor(luminances.length / 2)] >= LIGHT_TEXT_THRESHOLD;
}

// Readable title/icon colour over a user-picked spine colour: dark text on
// light colours, white on dark ones.
export function contrastTextColor(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const luminance =
    0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
  return luminance >= 150 ? "#161616" : "#ffffff";
}

export function caseSize(
  platform: string,
  gameId: number,
  templateSize?: { width: number; height: number }
): { width: number; height: number } {
  if (templateSize) return templateSize;
  const flat = spineStyle(platform, gameId);
  return { width: flat.width, height: flat.height };
}

export interface ShelfRowItem {
  kind: "bookend" | "case";
  platform: string;
  entry?: ShelfCase;
  width: number;
  height: number;
}

export const BOOKEND_WIDTH = 38;
const CASE_GAP = 3;

// Cases flow continuously across platforms — the next platform starts right
// where the previous one ended instead of forcing a new shelf. Rows are
// packed greedily against the measured shelf width so EVERY row sits on its
// own shelf board. A platform's bookend tile leads its first case and is
// never left orphaned at a row's end.
export function packRows(
  shelves: Shelf[],
  maxWidth: number,
  caseSizes?: Map<string, { width: number; height: number }>
): ShelfRowItem[][] {
  const items: ShelfRowItem[] = [];
  for (const shelf of shelves) {
    items.push({
      kind: "bookend",
      platform: shelf.platform,
      width: BOOKEND_WIDTH,
      height: spineStyle(shelf.platform, 0).height,
    });
    for (const entry of shelf.cases) {
      const size = caseSize(entry.platform, entry.game.id, caseSizes?.get(entry.platform));
      items.push({
        kind: "case",
        platform: shelf.platform,
        entry,
        width: size.width,
        height: size.height,
      });
    }
  }
  const rows: ShelfRowItem[][] = [];
  let row: ShelfRowItem[] = [];
  let rowWidth = 0;
  items.forEach((item, index) => {
    let needed = item.width;
    // A bookend must share its row with its platform's first case.
    if (item.kind === "bookend" && index + 1 < items.length) {
      needed += CASE_GAP + items[index + 1].width;
    }
    if (row.length > 0 && rowWidth + CASE_GAP + needed > maxWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    if (row.length > 0) rowWidth += CASE_GAP;
    rowWidth += item.width;
    row.push(item);
  });
  if (row.length > 0) rows.push(row);
  return rows;
}

export function useTemplateInfo(
  platforms: PlatformResponse[] | undefined
): Map<string, TemplateInfo> {
  const [templateInfo, setTemplateInfo] = useState<Map<string, TemplateInfo>>(new Map());
  useEffect(() => {
    for (const platform of platforms ?? []) {
      if (!platform.spineTemplateUrl) continue;
      const label = platform.abbreviation ?? platform.name;
      if (templateInfo.has(label)) continue;
      const image = new Image();
      image.onload = () => {
        if (image.naturalHeight <= 0) return;
        let light = false;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 16;
          canvas.height = 64;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(image, 0, 0, 16, 64);
            light = titleBandLight(context.getImageData(0, 0, 16, 64).data, 16, 64);
          }
        } catch {
          light = false;
        }
        const info: TemplateInfo = {
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          light,
        };
        setTemplateInfo((previous) => {
          if (previous.has(label)) return previous;
          const next = new Map(previous);
          next.set(label, info);
          return next;
        });
      };
      image.src = resolveAssetUrl(platform.spineTemplateUrl) ?? platform.spineTemplateUrl;
    }
  }, [platforms, templateInfo]);
  return templateInfo;
}

// Measures the shelf container's width for row packing. The shelf only
// renders after its data loads, so the measurement has to follow the
// element: a mount-once effect reads a null ref while the page is still
// loading and never runs again, leaving rows packed for the 1200px default
// on every cold load — overflowing narrow screens, underfilling wide ones,
// and stalling the progressive loader whose sentinel math assumes rows of
// the real width. A callback ref + layout effect measures on every
// (re)mount, before paint, and keeps tracking resizes.
export function useShelfWidth(): {
  shelfRef: (element: HTMLDivElement | null) => void;
  shelfWidth: number;
} {
  const [shelfElement, setShelfElement] = useState<HTMLDivElement | null>(null);
  const [shelfWidth, setShelfWidth] = useState(1200);
  useLayoutEffect(() => {
    if (!shelfElement) return;
    const update = () => setShelfWidth(shelfElement.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(shelfElement);
    return () => observer.disconnect();
  }, [shelfElement]);
  return { shelfRef: setShelfElement, shelfWidth };
}

export interface BookshelfGridProps {
  rows: ShelfRowItem[][];
  platformsByLabel: Map<string, PlatformResponse>;
  templateInfo: Map<string, TemplateInfo>;
  onCaseClick: (game: ShelfGame) => void;
  // Private shelf only: bookends open the template dialog. Public pages omit
  // it and the bookends render as plain (non-interactive) dividers.
  onBookendClick?: (platform: PlatformResponse) => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  hasMore?: boolean;
}

// The shelf itself — packed rows of cases on wood boards — shared by the
// private Bookshelf page and its public share-link twin.
const BookshelfGrid = ({
  rows,
  platformsByLabel,
  templateInfo,
  onCaseClick,
  onBookendClick,
  sentinelRef,
  hasMore,
}: BookshelfGridProps) => {
  const { t } = useTranslation();
  return (
    <>
{rows.map((row, rowIndex) => (
  <Box key={rowIndex} sx={{ mb: 3 }}>
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", px: 1 }}>
      {row.map((item) => {
        if (item.kind === "bookend") {
          const style = spineStyle(item.platform, 0);
          const record = platformsByLabel.get(item.platform);
          return (
            <Box
              key={`bookend-${item.platform}`}
              component="button"
              title={t("games.bookshelf.template.forPlatform", { platform: item.platform })}
              onClick={onBookendClick && record ? () => onBookendClick(record) : undefined}
              sx={{
                width: BOOKEND_WIDTH,
                height: style.height,
                flexShrink: 0,
                p: 0,
                cursor: "pointer",
                border: "1px solid #000",
                borderRadius: "2px 2px 0 0",
                background: "linear-gradient(180deg, #2b2b2e 0%, #000000 100%)",
                color: "#ffffff",
                boxShadow:
                  "inset -3px 0 6px rgba(0,0,0,0.9), inset 2px 0 4px rgba(255,255,255,0.22), 0 0 0 1px rgba(0,0,0,0.55), 2px 0 6px rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 120ms ease",
                "&:hover": { transform: "translateY(-6px)" },
              }}
            >
              <Box
                sx={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxHeight: "100%",
                  py: 0.75,
                }}
              >
                {item.platform}
              </Box>
            </Box>
          );
        }
        const entry = item.entry!;
        const style = spineStyle(entry.platform, entry.game.id);
        const platformRecord = platformsByLabel.get(entry.platform);
        const templateUrl = platformRecord?.spineTemplateUrl ?? null;
        // Generic-spine styling: the platform's chosen colour wins
        // over the brand colour, and its icon sits at the top.
        const genericColor = !templateUrl ? platformRecord?.spineColor ?? null : null;
        const showSpineIcon = !templateUrl;
        const spineIconKey = platformRecord?.spineIcon ?? "logo";
        const templateLight = templateUrl
          ? (templateInfo.get(entry.platform)?.light ?? false)
          : false;
        return (
          <Box
            key={`${entry.game.id}-${entry.platform}`}
            component="button"
            title={`${entry.game.name} — ${entry.platform}`}
            onClick={() => onCaseClick(entry.game)}
            sx={{
              width: item.width,
              height: item.height,
              p: 0,
              border: "none",
              borderRadius: "2px 2px 0 0",
              cursor: "pointer",
              overflow: "hidden",
              position: "relative",
              flexShrink: 0,
              transition: "transform 120ms ease",
              "&:hover": { transform: "translateY(-6px)" },
              backgroundColor: genericColor ?? style.background,
              color: templateUrl
                ? templateLight
                  ? "#161616"
                  : "#ffffff"
                : genericColor
                  ? contrastTextColor(genericColor)
                  : style.color,
              boxShadow: "inset -3px 0 5px rgba(0,0,0,0.35), inset 2px 0 3px rgba(255,255,255,0.15)",
            }}
          >
            {templateUrl && (
              <Box
                component="img"
                src={resolveAssetUrl(templateUrl) ?? undefined}
                alt=""
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  // The case is sized to the template's aspect
                  // (see caseSize), so the image fills it exactly —
                  // scaled, never cropped, never stretched.
                  objectFit: "fill",
                  display: "block",
                }}
              />
            )}
            {showSpineIcon && (
              <Box
                sx={{
                  position: "absolute",
                  top: 4,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <SpineIconGlyph
                  iconKey={spineIconKey}
                  slug={platformRecord?.slug}
                  iconUrl={platformRecord?.spineIconUrl}
                  size={Math.max(12, Math.min(22, Math.round(item.width * 0.72)))}
                />
              </Box>
            )}
            <Box
              sx={{
                writingMode: "vertical-rl",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.4,
                lineHeight: 1.15,
                maxHeight: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                mx: "auto",
                // The title prints only inside the universal
                // title band (GameCube-reference spacing): clear
                // of the logo zones at both ends of the spine.
                pt: `${Math.round(item.height * TITLE_TOP_INSET)}px`,
                pb: `${Math.round(item.height * TITLE_BOTTOM_INSET)}px`,
                height: "100%",
                position: "relative",
                ...(templateUrl
                  ? {
                      textShadow: templateLight
                        ? "0 1px 2px rgba(255,255,255,0.65), 0 0 5px rgba(255,255,255,0.5)"
                        : "0 1px 3px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.75)",
                    }
                  : {}),
              }}
            >
              {entry.game.name}
            </Box>
          </Box>
        );
      })}
    </Box>
    <Box
      sx={{
        height: 14,
        background: "linear-gradient(180deg, #8b5a2b 0%, #6f4520 55%, #59371a 100%)",
        borderRadius: "0 0 4px 4px",
        boxShadow: "0 6px 10px rgba(0,0,0,0.35)",
      }}
    />
  </Box>
))}
      {hasMore && <Box ref={sentinelRef} sx={{ height: 1 }} />}
    </>
  );
};

export default BookshelfGrid;
