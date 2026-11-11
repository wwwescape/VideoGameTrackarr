import { useCallback, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import SortIcon from "@mui/icons-material/Sort";
import TuneIcon from "@mui/icons-material/Tune";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { GameSortOption, ShelfCaseEntry } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicLabEnabled, usePublicShelf } from "../hooks/usePublic";
import { useSessionState } from "../hooks/useSessionState";
import {
  GAME_SORT_FIELDS,
  gameSortDirection,
  gameSortField,
  makeGameSort,
  pickGameSortField,
  type GameSortField,
} from "../utils/gameSortOptions";
import { buildShelfItems } from "../utils/shelfLayout";
import GameShelf from "./GameShelf";
import { ListSearchField, SortMenu } from "./ListControls";
import { ToolbarButton } from "./Page";
import PublicPageHeader from "./PublicPageHeader";
import { ShelfOptionsMenu, useShelfScale } from "./ShelfOptions";

// The public Games tab's sorts, minus Library (everything on a shelf is owned).
const PUBLIC_SHELF_SORT_FIELDS: GameSortField[] = ["name", "date_added", "type", "release_date"];

// The share page's read-only Game Shelf (shown while the Game Shelf lab is on): the same
// shelf as Games → Game Shelf, with search and sort, and each case opening the shared game page.
const PublicShelf = ({ token }: { token: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useSessionState("public.shelf.search", "");
  const [sort, setSort] = useSessionState<GameSortOption>("public.shelf.sort", "name_asc");
  const [menu, setMenu] = useState<{ name: "options" | "sort"; anchor: HTMLElement } | null>(null);
  const [scale, setScale] = useShelfScale();
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  const { data: shelf, isLoading } = usePublicShelf(token, debouncedSearch || undefined, sort);

  const items = useMemo(
    () => (shelf ? buildShelfItems(shelf.cases, shelf.platforms, scale) : []),
    [shelf, scale]
  );
  const openCase = useCallback(
    (shelfCase: ShelfCaseEntry) => navigate(`/public/${token}/games/${shelfCase.gameId}`),
    [navigate, token]
  );

  return (
    <>
      <PublicPageHeader title={t("public.shelf.title")}>
        <ListSearchField
          value={search}
          onChange={setSearch}
          label={t("public.shelf.searchLabel")}
          placeholder={t("games.listToolbar.searchPlaceholder")}
        />
        <ToolbarButton
          icon={<TuneIcon />}
          label={t("games.listView.options")}
          onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
          aria-haspopup="menu"
          sx={{ flexDirection: "row", flexShrink: 0 }}
        />
        <ToolbarButton
          icon={<SortIcon />}
          label={t("games.listView.sort")}
          onClick={(event) => setMenu({ name: "sort", anchor: event.currentTarget })}
          aria-haspopup="menu"
          sx={{ flexDirection: "row", flexShrink: 0 }}
        />
        <ShelfOptionsMenu
          anchor={menu?.name === "options" ? menu.anchor : null}
          onClose={() => setMenu(null)}
          scale={scale}
          onScaleChange={setScale}
        />
        <SortMenu
          anchor={menu?.name === "sort" ? menu.anchor : null}
          onClose={() => setMenu(null)}
          fields={GAME_SORT_FIELDS.filter((option) =>
            PUBLIC_SHELF_SORT_FIELDS.includes(option.field)
          ).map((option) => ({ value: option.field, label: t(option.labelKey) }))}
          field={gameSortField(sort)}
          direction={gameSortDirection(sort)}
          onFieldChange={(field) => setSort(pickGameSortField(sort, field))}
          onDirectionChange={(direction) => setSort(makeGameSort(gameSortField(sort), direction))}
        />
      </PublicPageHeader>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.shelf.emptyState")}</Paper>
      ) : (
        <GameShelf items={items} onOpenCase={openCase} />
      )}
    </>
  );
};

// Off unless the owner has the Game Shelf lab on; an old link lands on the Games tab instead.
const PublicShelfPage = () => {
  const { token } = useParams<{ token: string }>();
  const { enabled, isLoading } = usePublicLabEnabled(token, "game_shelf");
  if (!token || isLoading) return null;
  return enabled ? (
    <PublicShelf token={token} />
  ) : (
    <Navigate to={`/public/${token}/games`} replace />
  );
};

export default PublicShelfPage;
