import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { useCollectionAddons, useFranchiseAddons } from "../hooks/useCatalogBrowse";
import { useGameListState } from "../hooks/useGameListState";
import { useGames } from "../hooks/useGames";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { usePlatformAddons } from "../hooks/usePlatforms";
import { useSessionState } from "../hooks/useSessionState";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import type { PlatformScope } from "../utils/platformScope";
import { useCatalogResync } from "./CatalogResync";
import { Section } from "./Detail";
import GameCard from "./GameCard";
import type { OwnershipStatus } from "./GameFilterDialog";
import { useGameListControls, type ListToggle } from "./GameListControls";
import { CARD_SIZE_DEFAULT, GameCoverGrid, GameOverviewRows, GameTable, type GameListView } from "./GameListViews";
import Page from "./Page";

function filterByOwnershipAndMissing(
  list: GameSummary[] | undefined,
  ownershipStatuses: OwnershipStatus[],
  ownershipExclude: boolean,
  ownershipMatchAll: boolean | undefined,
  showMissing: boolean
): GameSummary[] {
  let result = list ?? [];
  if (ownershipStatuses.length > 0) {
    result = result.filter((game) => matchesOwnership(game, ownershipStatuses, ownershipExclude, ownershipMatchAll));
  }
  if (!showMissing) {
    result = result.filter((game) => game.owned || game.wishlisted);
  }
  return result;
}

export type CatalogBrowseKind = "collection" | "series" | "platform";

interface CatalogBrowseGridProps {
  kind: CatalogBrowseKind;
  kindLabel: string;
  entityId: number | undefined;
  isLoading: boolean;
  slug: string | undefined;
  // Collections and Series only: a Platform page lists your own copies, so there's nothing
  // to resync from IGDB.
  resyncLabel?: string;
  // Platform pages only: a PC storefront card's format/storefront (see utils/platformScope.ts).
  platformScope?: PlatformScope;
}

const NO_SELECTION: ReadonlySet<number> = new Set();

// A sibling of GameList.tsx — same filters, toolbar and views (see GameListControls) — but scoped
// to one Collection/Series/Platform (via requiredCollectionId/requiredFranchiseId/
// requiredPlatformId on the Games fetch, and the dedicated .../addons endpoints for the Add-ons
// section) instead of the whole library, and with no bulk selection (this page has no bulk
// actions).
const CatalogBrowseGrid = ({
  kind,
  kindLabel,
  entityId,
  isLoading,
  slug,
  resyncLabel,
  platformScope,
}: CatalogBrowseGridProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCollection = kind === "collection";
  const isSeries = kind === "series";
  const isPlatform = kind === "platform";
  // Remembered per collection/series/platform for the session, so filters set on one don't
  // carry over to another (see hooks/useSessionState.ts).
  const scopeKey = platformScope?.format ? `.${platformScope.format}.${platformScope.storefront ?? ""}` : "";
  const stateKey = `${kind}.${slug ?? ""}${scopeKey}`;
  const state = useGameListState(stateKey);
  // Off by default (unlike the Games page's default-on) — preserves the pre-existing "only
  // games I've added" view; a Resync is what starts populating games that are neither owned
  // nor wishlisted here at all.
  const [showMissing, setShowMissing] = useSessionState(`${stateKey}.showMissing`, false);
  const [includeAddons, setIncludeAddons] = useSessionState(`${stateKey}.includeAddons`, false);
  const [view, setView] = useLocalPreference<GameListView>("catalog.view", "covers");
  const [cardSize, setCardSize] = useLocalPreference("catalog.cardSize", CARD_SIZE_DEFAULT);

  const toggles: ListToggle[] = [
    ...(!isPlatform
      ? [{ key: "missing", label: t("games.listToolbar.showMissingLabel"), checked: showMissing, onChange: setShowMissing }]
      : []),
    { key: "addons", label: t("catalog.browseGrid.includeAddonsLabel"), checked: includeAddons, onChange: setIncludeAddons },
  ];
  const controls = useGameListControls(state, {
    view,
    setView,
    cardSize,
    setCardSize,
    hidePlatformsField: isPlatform,
    hideCollectionsField: isCollection,
    hideFranchisesField: isSeries,
    toggles,
  });
  const resync = useCatalogResync({
    kind: isCollection ? "collection" : "franchise",
    slug: resyncLabel && !isPlatform ? slug : undefined,
    label: resyncLabel ?? "",
  });

  const sharedFilters = state.apiFilters;
  const gamesFilters = useMemo(
    () => ({
      ...sharedFilters,
      requiredCollectionId: isCollection ? entityId : undefined,
      requiredFranchiseId: isSeries ? entityId : undefined,
      requiredPlatformId: isPlatform ? entityId : undefined,
      requiredPlatformFormat: isPlatform ? platformScope?.format : undefined,
      requiredPlatformStorefront: isPlatform ? platformScope?.storefront : undefined,
    }),
    [sharedFilters, isCollection, isSeries, isPlatform, entityId, platformScope?.format, platformScope?.storefront]
  );
  const platformAddonFilters = useMemo(
    () => ({
      ...sharedFilters,
      requiredPlatformFormat: platformScope?.format,
      requiredPlatformStorefront: platformScope?.storefront,
    }),
    [sharedFilters, platformScope?.format, platformScope?.storefront]
  );
  const { data: games, isLoading: isGamesLoading } = useGames(gamesFilters, { enabled: !!entityId });

  const { data: collectionAddons, isLoading: isCollectionAddonsLoading } = useCollectionAddons(
    isCollection ? slug : undefined,
    sharedFilters,
    includeAddons && isCollection
  );
  const { data: franchiseAddons, isLoading: isFranchiseAddonsLoading } = useFranchiseAddons(
    isSeries ? slug : undefined,
    sharedFilters,
    includeAddons && isSeries
  );
  const { data: platformAddons, isLoading: isPlatformAddonsLoading } = usePlatformAddons(
    isPlatform ? slug : undefined,
    platformAddonFilters,
    includeAddons && isPlatform
  );
  const addons = isCollection ? collectionAddons : isSeries ? franchiseAddons : platformAddons;
  const isAddonsLoading = isCollection ? isCollectionAddonsLoading : isSeries ? isFranchiseAddonsLoading : isPlatformAddonsLoading;

  const { statuses, exclude, matchAll } = state.ownership;
  const visibleGames = useMemo(
    () => filterByOwnershipAndMissing(games, statuses, exclude, matchAll, showMissing),
    [games, statuses, exclude, matchAll, showMissing]
  );
  const visibleAddons = useMemo(
    () => filterByOwnershipAndMissing(addons, statuses, exclude, matchAll, showMissing),
    [addons, statuses, exclude, matchAll, showMissing]
  );

  const handleGameClick = (game: GameSummary) => navigate(`/game/${gameIdentifier(game)}`);

  const empty = (message: string) => <Paper sx={{ p: 3, textAlign: "center" }}>{message}</Paper>;
  const renderList = (list: GameSummary[], context: "list" | "addon") => {
    const rows = { games: list, onOpen: handleGameClick, selecting: false, selectedIds: NO_SELECTION, onToggleSelect: () => {} };
    if (view === "table") return <GameTable {...rows} />;
    if (view === "overview") return <GameOverviewRows {...rows} />;
    return (
      <GameCoverGrid
        games={list}
        cardSize={cardSize}
        showRail={context === "list" && state.sort === "name_asc"}
        renderCard={(game) => <GameCard game={game} context={context} contextFunction={() => handleGameClick(game)} />}
      />
    );
  };
  const gamesEmpty = t("catalog.browseGrid.emptyMessage", { kind: kindLabel.toLowerCase() });

  return (
    <Page
      meta={games ? t("games.listView.gameCount", { count: visibleGames.length }) : undefined}
      toolbar={resync.button ?? undefined}
      toolbarEnd={controls.toolbarEnd}
      actions={controls.searchField}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isPlatform ? t("catalog.browseGrid.platformNotice") : t("catalog.browseGrid.importedOnlyNotice")}
      </Typography>
      {resync.status}
      {controls.chipRow}
      {isLoading || isGamesLoading ? (
        empty(t("common.loading"))
      ) : includeAddons ? (
        <>
          <Section id="games" title={t("catalog.browseGrid.gamesSectionTitle")}>
            {visibleGames.length === 0 ? empty(gamesEmpty) : renderList(visibleGames, "list")}
          </Section>
          <Section id="addons" title={t("catalog.browseGrid.addonsSectionTitle")}>
            {isAddonsLoading
              ? empty(t("common.loading"))
              : visibleAddons.length === 0
                ? empty(t("games.listToolbar.noSearchMatches"))
                : renderList(visibleAddons, "addon")}
          </Section>
        </>
      ) : visibleGames.length === 0 ? (
        empty(gamesEmpty)
      ) : (
        renderList(visibleGames, "list")
      )}
      {controls.dialogs}
    </Page>
  );
};

export default CatalogBrowseGrid;
