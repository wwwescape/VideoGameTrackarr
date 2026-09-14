import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSortOption, MediaFormat } from "../api/types";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMissingAddons } from "../hooks/useInsights";
import { usePlatforms } from "../hooks/usePlatforms";
import { useStorefronts } from "../hooks/useStorefronts";
import { useTags } from "../hooks/useTags";
import { gameIdentifier } from "../utils/identifiers";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import GameCard from "./GameCard";
import GameListToolbar, { type OwnershipStatus } from "./GameListToolbar";
import VirtualList from "./VirtualList";

const MIN_SEARCH_LENGTH = 3;

const MissingAddonsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchKeyword, setSearchKeyword] = useState("");
  const [ownershipStatuses, setOwnershipStatuses] = useState<OwnershipStatus[]>([]);
  const [ownershipExclude, setOwnershipExclude] = useState(false);
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [platformExclude, setPlatformExclude] = useState(false);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tagExclude, setTagExclude] = useState(false);
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [collectionExclude, setCollectionExclude] = useState(false);
  const [franchiseIds, setFranchiseIds] = useState<number[]>([]);
  const [franchiseExclude, setFranchiseExclude] = useState(false);
  const [formats, setFormats] = useState<MediaFormat[]>([]);
  const [formatExclude, setFormatExclude] = useState(false);
  const [storefronts, setStorefronts] = useState<string[]>([]);
  const [storefrontExclude, setStorefrontExclude] = useState(false);
  const [sort, setSort] = useState<GameSortOption>("name_asc");

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const { data: platforms = [] } = usePlatforms();
  const { data: tags = [] } = useTags();
  const { data: collections = [] } = useCollections();
  const { data: franchises = [] } = useFranchises();
  const { data: realStorefronts = [] } = useStorefronts();
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  const filters = useMemo(
    () => ({
      search: isSearchActive ? debouncedKeyword : undefined,
      platformIds: platformIds.length > 0 ? platformIds : undefined,
      platformExclude,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      tagExclude,
      collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
      collectionExclude,
      franchiseIds: franchiseIds.length > 0 ? franchiseIds : undefined,
      franchiseExclude,
      // No categories/categoryExclude here — this page has no Game Types filter at all
      // (see hideGameTypesField below): everything shown is inherently an addon, so
      // filtering by main_game/bundle/etc would never match anything.
      formats: formats.length > 0 ? formats : undefined,
      formatExclude,
      storefronts: storefronts.length > 0 ? storefronts : undefined,
      storefrontExclude,
      sort,
    }),
    [
      isSearchActive,
      debouncedKeyword,
      platformIds,
      platformExclude,
      tagIds,
      tagExclude,
      collectionIds,
      collectionExclude,
      franchiseIds,
      franchiseExclude,
      formats,
      formatExclude,
      storefronts,
      storefrontExclude,
      sort,
    ]
  );

  const { data: entries } = useMissingAddons(filters);

  // Ownership is never sent server-side (see GameList.tsx/CatalogBrowseGrid.tsx's identical
  // client-side treatment) — here it narrows each entry's addons rather than a flat list, so
  // a group whose addons are all filtered out drops out entirely instead of showing an empty
  // addon grid under its game's name.
  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    if (ownershipStatuses.length === 0) return entries;
    return entries
      .map((entry) => ({
        ...entry,
        missingAddons: entry.missingAddons.filter((addon) => {
          const matches = ownershipStatuses.some((status) =>
            status === "owned" ? addon.owned : addon.wishlisted
          );
          return ownershipExclude ? !matches : matches;
        }),
      }))
      .filter((entry) => entry.missingAddons.length > 0);
  }, [entries, ownershipStatuses, ownershipExclude]);

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <GameListToolbar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          ownershipStatuses={ownershipStatuses}
          onOwnershipStatusesChange={setOwnershipStatuses}
          ownershipExclude={ownershipExclude}
          onOwnershipExcludeChange={setOwnershipExclude}
          platformOptions={platforms}
          platformIds={platformIds}
          onPlatformIdsChange={setPlatformIds}
          platformExclude={platformExclude}
          onPlatformExcludeChange={setPlatformExclude}
          tagOptions={tags}
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          tagExclude={tagExclude}
          onTagExcludeChange={setTagExclude}
          collectionOptions={collections}
          collectionIds={collectionIds}
          onCollectionIdsChange={setCollectionIds}
          collectionExclude={collectionExclude}
          onCollectionExcludeChange={setCollectionExclude}
          franchiseOptions={franchises}
          franchiseIds={franchiseIds}
          onFranchiseIdsChange={setFranchiseIds}
          franchiseExclude={franchiseExclude}
          onFranchiseExcludeChange={setFranchiseExclude}
          gameTypes={[]}
          onGameTypesChange={() => {}}
          gameTypeExclude={false}
          onGameTypeExcludeChange={() => {}}
          hideGameTypesField
          formats={formats}
          onFormatsChange={setFormats}
          formatExclude={formatExclude}
          onFormatExcludeChange={setFormatExclude}
          storefrontOptions={storefrontOptions}
          storefronts={storefronts}
          onStorefrontsChange={setStorefronts}
          storefrontExclude={storefrontExclude}
          onStorefrontExcludeChange={setStorefrontExclude}
          sort={sort}
          onSortChange={setSort}
        />
      </Box>
      {!entries || entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("insights.missingAddons.noneFound")}
        </Typography>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <VirtualList
          items={visibleEntries}
          getKey={(entry) => entry.game.id}
          estimateSize={() => 280}
          gap={24}
          renderItem={(entry) => (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {entry.game.name}
              </Typography>
              {/* Fixed 16px gap at every breakpoint, matching VirtualGameGrid/CardCarousel's own
                  GRID_GAP_PX — keeps this grid's card width consistent with every other GameCard
                  surface, not just its own column counts. */}
              <Grid container spacing={2}>
                {entry.missingAddons.map((addon) => (
                  <Grid key={addon.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                    <GameCard
                      game={addon}
                      context="addon"
                      contextFunction={() => navigate(`/addon/${gameIdentifier(addon)}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        />
      )}
    </>
  );
};

export default MissingAddonsSection;
