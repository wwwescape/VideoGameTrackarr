import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { fetchBookshelfEntries } from "../api/games";
import type { BookshelfEntry, PlatformResponse } from "../api/types";
import { usePlatforms } from "../hooks/usePlatforms";
import { gameIdentifier } from "../utils/identifiers";
import BookshelfGrid, { packRows, useShelfWidth, useTemplateInfo } from "./BookshelfGrid";
import type { Shelf, ShelfCase, ShelfGame, TemplateInfo } from "./BookshelfGrid";
import GamesSubNav from "./GamesSubNav";
import PlatformTemplateDialog from "./PlatformTemplateDialog";
import { caseSizeToPixels, effectiveCaseSizeMm } from "../utils/caseSizes";

// The spine/shelf primitives live in BookshelfGrid (shared with the public
// shelf page); re-exported here so existing imports keep working.
export {
  BOOKEND_WIDTH,
  caseSize,
  contrastTextColor,
  packRows,
  spineStyle,
  TITLE_BOTTOM_INSET,
  TITLE_TOP_INSET,
  titleBandLight,
} from "./BookshelfGrid";
export type { ShelfRowItem } from "./BookshelfGrid";

// One case per owned (game x platform) entry — the bookshelf shows what
// physically sits on the shelf, so a game owned on two platforms appears twice.
export function buildShelvesFromEntries(entries: BookshelfEntry[] | undefined): Shelf[] {
  const byPlatform = new Map<string, ShelfCase[]>();
  for (const entry of entries ?? []) {
    const game: ShelfGame = {
      id: entry.gameId,
      name: entry.name,
      slug: entry.gameSlug,
      uuid: entry.gameUuid,
    };
    const list = byPlatform.get(entry.platformLabel) ?? [];
    list.push({ game, platform: entry.platformLabel });
    byPlatform.set(entry.platformLabel, list);
  }
  return [...byPlatform.entries()]
    .map(([platform, cases]) => ({
      platform,
      cases: cases.sort((a, b) => a.game.name.localeCompare(b.game.name)),
    }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

// Shelf platforms are labelled by abbreviation when IGDB has one ("PS5"),
// else the full name — index the platform catalogue by that same label so a
// divider or case can find its platform record (template, id, ...).
export function indexPlatformsByLabel(
  platforms: PlatformResponse[] | undefined
): Map<string, PlatformResponse> {
  return new Map((platforms ?? []).map((p) => [p.abbreviation ?? p.name, p]));
}

// Each case's copy formats, for the Format filter — the slim endpoint
// already resolved the platform label and merged duplicate copies' formats.
export function caseFormatsKey(gameId: number, platform: string) {
  return `${gameId}|${platform}`;
}

export function buildCaseFormatsFromEntries(
  entries: BookshelfEntry[] | undefined
): Map<string, Set<string>> {
  const formats = new Map<string, Set<string>>();
  for (const entry of entries ?? []) {
    if (entry.formats.length === 0) continue;
    formats.set(caseFormatsKey(entry.gameId, entry.platformLabel), new Set(entry.formats));
  }
  return formats;
}

// Templated cases share ONE scale, set by the largest template ON THE SHELF:
// the tallest of those renders at TEMPLATE_TARGET_HEIGHT and the others
// scale proportionally to it, keeping their true relative sizes. Two guards
// keep pixel dimensions from wrecking the shelf: templates for platforms
// with no cases here don't set the scale (one huge stray scan can't shrink
// everything), and the proportional shrink is floored at MIN_TEMPLATE_RATIO
// so no case renders tiny — widths always follow the same factor, so the
// aspect stays exact and nothing is ever cropped or stretched.
export const TEMPLATE_TARGET_HEIGHT = 190;
export const MIN_TEMPLATE_RATIO = 0.6;
export function buildTemplateCaseSizes(
  info: Map<string, TemplateInfo>,
  targetHeight: number = TEMPLATE_TARGET_HEIGHT,
  shelfLabels?: Set<string>
): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  const included = [...info.entries()].filter(([label]) => !shelfLabels || shelfLabels.has(label));
  let largest = 0;
  for (const [, template] of included) {
    largest = Math.max(largest, template.naturalHeight);
  }
  if (largest <= 0) return sizes;
  for (const [label, template] of included) {
    const ratio = Math.max(template.naturalHeight / largest, MIN_TEMPLATE_RATIO);
    const height = targetHeight * ratio;
    sizes.set(label, {
      width: Math.max(1, Math.round(height * (template.naturalWidth / template.naturalHeight))),
      height: Math.max(1, Math.round(height)),
    });
  }
  return sizes;
}

// The fixed size a platform's cases render at, in priority order: the
// platform's ACTUAL physical case size at 40% (user-chosen or the known size
// for the system) beats the template-proportional size. Platforms with
// neither get no entry and keep their varied flat spines.
export function resolvePlatformCaseSizes(
  labels: string[],
  platformsByLabel: Map<string, PlatformResponse>,
  templateSizes: Map<string, { width: number; height: number }>
): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const label of labels) {
    const record = platformsByLabel.get(label);
    const actual = record ? effectiveCaseSizeMm(record) : null;
    if (actual) {
      sizes.set(label, caseSizeToPixels(actual.heightMm, actual.spineMm));
    } else if (templateSizes.has(label)) {
      sizes.set(label, templateSizes.get(label)!);
    }
  }
  return sizes;
}

const BookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // One slim request (owned game x platform rows) instead of the full games
  // list + every library item — the shelf was the slowest page to load.
  const { data: entries, isLoading } = useQuery({
    queryKey: ["bookshelf-entries"],
    queryFn: fetchBookshelfEntries,
    staleTime: 5 * 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [templatePlatform, setTemplatePlatform] = useState<PlatformResponse | null>(null);

  const { data: platforms } = usePlatforms();
  const caseFormats = useMemo(() => buildCaseFormatsFromEntries(entries), [entries]);
  const platformsByLabel = useMemo(() => indexPlatformsByLabel(platforms), [platforms]);
  const templateInfo = useTemplateInfo(platforms);
  const formatOptions = useMemo(
    () => [...new Set([...caseFormats.values()].flatMap((set) => [...set]))].sort(),
    [caseFormats]
  );

  const shelves = useMemo(() => buildShelvesFromEntries(entries), [entries]);
  const keyword = search.trim().toLowerCase();
  const templateCaseSizes = useMemo(
    () => buildTemplateCaseSizes(templateInfo, TEMPLATE_TARGET_HEIGHT, new Set(shelves.map((s) => s.platform))),
    [templateInfo, shelves]
  );
  const platformCaseSizes = useMemo(
    () =>
      resolvePlatformCaseSizes(
        shelves.map((s) => s.platform),
        platformsByLabel,
        templateCaseSizes
      ),
    [shelves, platformsByLabel, templateCaseSizes]
  );
  const visibleShelves = useMemo(
    () =>
      shelves
        .filter((shelf) => platformFilter === "all" || shelf.platform === platformFilter)
        .map((shelf) => ({
          ...shelf,
          cases: shelf.cases.filter((entry) => {
            if (keyword && !entry.game.name.toLowerCase().includes(keyword)) return false;
            if (
              formatFilter !== "all" &&
              !caseFormats.get(caseFormatsKey(entry.game.id, entry.platform))?.has(formatFilter)
            )
              return false;
            return true;
          }),
        }))
        .filter((shelf) => shelf.cases.length > 0),
    [shelves, keyword, platformFilter, formatFilter, caseFormats]
  );

  const totalCases = shelves.reduce((sum, shelf) => sum + shelf.cases.length, 0);

  // Rows are packed against the real shelf width (repacked on resize) so each
  // row of cases gets its own shelf board at any window size. The shelf only
  // renders once the entries arrive, so the width is measured whenever the
  // shelf element (re)mounts — see useShelfWidth in BookshelfGrid.
  const { shelfRef, shelfWidth } = useShelfWidth();
  const rows = useMemo(
    () => packRows(visibleShelves, Math.max(shelfWidth - 16, 200), platformCaseSizes),
    [visibleShelves, shelfWidth, platformCaseSizes]
  );

  // Rows render progressively: painting ~7,000 cases at once was the other
  // half of the slow load. Start with a screenful and grow as the sentinel
  // approaches; a new filter/search starts over from the top.
  const ROWS_PER_CHUNK = 10;
  const [visibleRowCount, setVisibleRowCount] = useState(ROWS_PER_CHUNK);
  useEffect(() => {
    setVisibleRowCount(ROWS_PER_CHUNK);
  }, [visibleShelves]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) {
          setVisibleRowCount((count) => Math.min(count + ROWS_PER_CHUNK, rows.length));
        }
      },
      { rootMargin: "900px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows, visibleRowCount]);
  const visibleRows = rows.slice(0, visibleRowCount);

  return (
    <Box>
      <GamesSubNav />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("games.bookshelf.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("games.bookshelf.summary", { cases: totalCases })}
          </Typography>
        </Box>
        <Stack spacing={1.5} sx={{ width: "100%", flex: { sm: 1 }, maxWidth: { sm: 620 } }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t("games.bookshelf.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <InputLabel>{t("games.listPage.platformColumn")}</InputLabel>
              <Select
                value={platformFilter}
                label={t("games.listPage.platformColumn")}
                onChange={(event) => setPlatformFilter(event.target.value)}
              >
                <MenuItem value="all">{t("common.all")}</MenuItem>
                {shelves.map((shelf) => (
                  <MenuItem key={shelf.platform} value={shelf.platform}>
                    {shelf.platform}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <InputLabel>{t("games.listPage.formatColumn")}</InputLabel>
              <Select
                value={formatFilter}
                label={t("games.listPage.formatColumn")}
                onChange={(event) => setFormatFilter(event.target.value)}
              >
                <MenuItem value="all">{t("common.all")}</MenuItem>
                {formatOptions.map((format) => (
                  <MenuItem key={format} value={format}>
                    {format}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Stack>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.bookshelf.empty")}</Paper>
      ) : (
        <Box ref={shelfRef}>
          <BookshelfGrid
            rows={visibleRows}
            platformsByLabel={platformsByLabel}
            templateInfo={templateInfo}
            onBookendClick={(record) => setTemplatePlatform(record)}
            onCaseClick={(game) => navigate(`/game/${gameIdentifier(game)}`)}
            sentinelRef={sentinelRef}
            hasMore={visibleRowCount < rows.length}
          />
        </Box>
      )}
      <PlatformTemplateDialog platform={templatePlatform} onClose={() => setTemplatePlatform(null)} />
    </Box>
  );
};

export default BookshelfPage;
