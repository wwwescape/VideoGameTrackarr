import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { fetchPublicBookshelf } from "../api/public";
import type { PlatformResponse } from "../api/types";
import {
  buildCaseFormatsFromEntries,
  buildShelvesFromEntries,
  buildTemplateCaseSizes,
  caseFormatsKey,
  indexPlatformsByLabel,
  resolvePlatformCaseSizes,
  TEMPLATE_TARGET_HEIGHT,
} from "./BookshelfPage";
import BookshelfGrid, { packRows, useShelfWidth, useTemplateInfo } from "./BookshelfGrid";

// The share-link Bookshelf: same shelf as the private page (shared grid,
// builders, and sizing), fed by the public endpoint — hidden games never
// appear, bookends are plain dividers, and a case opens the public game page.
const PublicBookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["public-bookshelf", token],
    queryFn: () => fetchPublicBookshelf(token!),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");

  const entries = data?.entries;
  // The public payload's platform records carry only display fields; widen
  // them to the catalogue shape the shelf helpers read.
  const platforms = useMemo<PlatformResponse[]>(
    () =>
      (data?.platforms ?? []).map((platform) => ({
        id: 0,
        igdbId: null,
        name: platform.name,
        slug: null,
        abbreviation: platform.abbreviation,
        spineTemplateUrl: platform.spineTemplateUrl,
        caseHeightMm: platform.caseHeightMm,
        caseSpineMm: platform.caseSpineMm,
        spineColor: platform.spineColor,
        spineIcon: platform.spineIcon,
        spineIconUrl: platform.spineIconUrl,
      })),
    [data]
  );
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

  // Same late-mount width measurement as the private shelf (see
  // useShelfWidth in BookshelfGrid).
  const { shelfRef, shelfWidth } = useShelfWidth();
  const rows = useMemo(
    () => packRows(visibleShelves, Math.max(shelfWidth - 16, 200), platformCaseSizes),
    [visibleShelves, shelfWidth, platformCaseSizes]
  );

  // Same progressive rendering as the private shelf.
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
            onCaseClick={(game) => navigate(`/public/${token}/games/${game.id}`)}
            sentinelRef={sentinelRef}
            hasMore={visibleRowCount < rows.length}
          />
        </Box>
      )}
    </Box>
  );
};

export default PublicBookshelfPage;
