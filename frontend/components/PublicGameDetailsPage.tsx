import { Link, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { usePublicGame } from "../hooks/usePublic";
import GameAboutSection from "./GameAboutSection";
import GameCoverCard from "./GameCoverCard";
import NotFoundPage from "./NotFoundPage";

const sectionCardSx = { borderRadius: 2, overflow: "hidden" } as const;

// The share page's read-only take on GameDetails: the cover and About section only. Tags,
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

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          {/* Sale tracking is the owner's own data, and the public list never shows "Missing". */}
          <GameCoverCard game={{ ...game, isOnSale: false, autoDiscovered: false }} />
          <Button
            component={Link}
            to={gamesPath}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            fullWidth
          >
            {t("errors.backTo", { page: t("public.nav.games") })}
          </Button>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={sectionCardSx}>
          <GameAboutSection game={game} publicToken={token} />
        </Card>
      </Grid>
    </Grid>
  );
};

export default PublicGameDetailsPage;
