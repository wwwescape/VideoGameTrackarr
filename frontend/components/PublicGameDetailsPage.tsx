import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { usePublicGame } from "../hooks/usePublic";
import { GameAboutBlock, GameHero, GameMediaSections } from "./GameDetailParts";
import NotFoundPage from "./NotFoundPage";

// The share page's read-only take on GameDetails: the hero, About and media only. Tags,
// Your Library, Addons, Progress and Notes are left out on purpose — the backend doesn't
// send that data here (see PublicGameDetailResponse).
const PublicGameDetailsPage = () => {
  const { t } = useTranslation();
  const { token, gameId: gameIdParam } = useParams<{ token: string; gameId: string }>();
  const gameId = Number(gameIdParam);
  const { data: game, isLoading, error } = usePublicGame(token, gameId);
  const gamesPath = `/public/${token}/games`;

  if (!Number.isFinite(gameId) || (isAxiosError(error) && error.response?.status === 404)) {
    return (
      <NotFoundPage
        title={t("errors.gameNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("public.nav.games") })}
        actionTo={gamesPath}
      />
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t("public.games.loadError")}
      </Alert>
    );
  }

  if (isLoading || !game) {
    return (
      <Stack sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  // Sale tracking and Missing are the owner's own data, so the hero leaves them out.
  return (
    <>
      <GameHero
        game={game}
        status={{ coverUrl: game.coverUrl, owned: game.owned, wishlisted: game.wishlisted }}
        crumbs={[{ label: t("public.nav.games"), to: gamesPath }]}
        publicToken={token}
      />
      <GameAboutBlock game={game} />
      <GameMediaSections game={game} />
    </>
  );
};

export default PublicGameDetailsPage;
