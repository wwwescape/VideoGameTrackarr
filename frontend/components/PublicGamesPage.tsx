import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SortIcon from "@mui/icons-material/Sort";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { GameSortOption } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicGames } from "../hooks/usePublic";
import { useSessionState } from "../hooks/useSessionState";
import {
  GAME_SORT_FIELDS,
  gameSortDirection,
  gameSortField,
  makeGameSort,
  pickGameSortField,
  PUBLIC_SORT_FIELDS,
} from "../utils/gameSortOptions";
import GameCard from "./GameCard";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import { ListSearchField, SortMenu } from "./ListControls";
import { ToolbarButton } from "./Page";
import PublicPageHeader from "./PublicPageHeader";
import VirtualGameGrid from "./VirtualGameGrid";

const PublicGamesPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Session-remembered (like sort) so coming back from a game's page restores the list.
  const [search, setSearch] = useSessionState("public.games.search", "");
  const [sort, setSort] = useSessionState<GameSortOption>("public.games.sort", "name_asc");
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  const { data: games, isLoading } = usePublicGames(token, debouncedSearch || undefined, sort);

  return (
    <>
      <PublicPageHeader title={t("public.games.title")}>
        <ListSearchField
          value={search}
          onChange={setSearch}
          label={t("public.games.searchLabel")}
          placeholder={t("games.listToolbar.searchPlaceholder")}
        />
        <ToolbarButton
          icon={<SortIcon />}
          label={t("games.listView.sort")}
          onClick={(event) => setSortAnchor(event.currentTarget)}
          aria-haspopup="menu"
          sx={{ flexDirection: "row", flexShrink: 0 }}
        />
        <SortMenu
          anchor={sortAnchor}
          onClose={() => setSortAnchor(null)}
          fields={GAME_SORT_FIELDS.filter((option) => PUBLIC_SORT_FIELDS.includes(option.field)).map((option) => ({
            value: option.field,
            label: t(option.labelKey),
          }))}
          field={gameSortField(sort)}
          direction={gameSortDirection(sort)}
          onFieldChange={(field) => setSort(pickGameSortField(sort, field))}
          onDirectionChange={(direction) => setSort(makeGameSort(gameSortField(sort), direction))}
        />
      </PublicPageHeader>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.games.emptyState")}</Paper>
      ) : (
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
          minItemWidth={CARD_SIZE_DEFAULT}
          renderItem={(game) => (
            <GameCard
              game={game}
              context="public"
              contextFunction={() => navigate(`/public/${token}/games/${game.id}`)}
            />
          )}
        />
      )}
    </>
  );
};

export default PublicGamesPage;
