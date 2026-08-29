import { useState } from "react";
import { useParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicGames } from "../hooks/usePublic";
import GameCard from "./GameCard";
import VirtualGameGrid from "./VirtualGameGrid";

const PublicGamesPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  const { data: games, isLoading } = usePublicGames(token, debouncedSearch || undefined);

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("public.games.title")}
      </Typography>
      <TextField
        label={t("public.games.searchLabel")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        fullWidth
        sx={{ mb: 3, maxWidth: 480 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.games.emptyState")}</Paper>
      ) : (
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
          renderItem={(game) => <GameCard game={game} context="public" />}
        />
      )}
    </>
  );
};

export default PublicGamesPage;
