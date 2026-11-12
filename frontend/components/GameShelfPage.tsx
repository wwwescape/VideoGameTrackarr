import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import type { ShelfCase } from "../api/types";
import { useGameListState } from "../hooks/useGameListState";
import { useGameShelf } from "../hooks/useGames";
import type { GameSortField } from "../utils/gameSortOptions";
import { gameIdentifier } from "../utils/identifiers";
import { buildShelfItems } from "../utils/shelfLayout";
import GameShelf from "./GameShelf";
import { withLab } from "./LabGate";
import { useGameListControls } from "./GameListControls";
import Page from "./Page";
import { ShelfScaleSlider, useShelfScale } from "./ShelfOptions";

// Labels is sorted outside the database, so the shelf can't offer it.
export const SHELF_SORT_FIELDS: GameSortField[] = [
  "name",
  "date_added",
  "release_date",
  "type",
  "platforms",
  "play_status",
  "rating",
];

// Games → Game Shelf (a Labs feature): every game you own a physical copy of, as a case on a
// shelf, one per platform you own it on, drawn as that platform's real case.
const GameShelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useGameListState("shelf", { sources: true, physicalPlatforms: true });
  const [scale, setScale] = useShelfScale();

  const controls = useGameListControls(state, {
    showViewMenu: false,
    // Everything on the shelf is an owned physical copy.
    hideOwnershipField: true,
    hideFormatsField: true,
    sortFields: SHELF_SORT_FIELDS,
    options: <ShelfScaleSlider value={scale} onChange={setScale} />,
  });

  const { data: shelf, isLoading, isFetching } = useGameShelf(state.apiFilters);
  const isSearching = state.isPendingDebounce || (state.isSearchActive && isFetching);

  const items = useMemo(
    () => (shelf ? buildShelfItems(shelf.cases, shelf.platforms, scale) : []),
    [shelf, scale]
  );
  const filtered = state.isSearchActive || controls.activeFilterCount > 0;

  // Stable, so the (memoized) shelf doesn't redraw when a menu opens.
  const openCase = useCallback(
    (shelfCase: ShelfCase) =>
      navigate(
        `/game/${gameIdentifier({ slug: shelfCase.slug, uuid: shelfCase.uuid, name: shelfCase.name })}`
      ),
    [navigate]
  );

  return (
    <Page
      meta={shelf ? t("games.shelf.caseCount", { count: items.length }) : undefined}
      toolbarEnd={controls.toolbarEnd}
      actions={controls.searchField}
    >
      {controls.chipRow}

      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : isSearching ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.list.searching")}</Paper>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          {filtered ? (
            t("games.shelf.noMatches")
          ) : (
            <>
              <Box sx={{ mb: 2 }}>{t("games.shelf.empty")}</Box>
              <Button component={RouterLink} to="/games/add" variant="contained">
                {t("games.list.addGameButton")}
              </Button>
            </>
          )}
        </Paper>
      ) : (
        <GameShelf items={items} onOpenCase={openCase} />
      )}

      {controls.dialogs}
    </Page>
  );
};

export default withLab("game_shelf", GameShelfPage);
