import { useNavigate, useParams } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSortOption } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicGames } from "../hooks/usePublic";
import { useSessionState } from "../hooks/useSessionState";
import GameCard from "./GameCard";
import PublicGamesToolbar from "./PublicGamesToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

const PublicGamesPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Session-remembered (like sort) so coming back from a game's page restores the list.
  const [search, setSearch] = useSessionState("public.games.search", "");
  const [sort, setSort] = useSessionState<GameSortOption>("public.games.sort", "name_asc");
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  const { data: games, isLoading } = usePublicGames(token, debouncedSearch || undefined, sort);

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("public.games.title")}
      </Typography>
      <PublicGamesToolbar search={search} onSearchChange={setSearch} sort={sort} onSortChange={setSort} />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.games.emptyState")}</Paper>
      ) : (
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
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
