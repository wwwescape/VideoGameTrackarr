import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useImportGame } from "../hooks/useGames";
import { useIgdbGamePreview } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import GameAboutSection from "./GameAboutSection";
import GameCoverCard from "./GameCoverCard";
import NotFoundPage from "./NotFoundPage";

const sectionCardSx = { borderRadius: 2, overflow: "hidden" } as const;

// Add Game → click a search result: read about a game straight from IGDB before adding it.
// Nothing is stored until "Add Game" is pressed (the backend preview endpoint never writes),
// so browsing search results never clutters the library. A game that's already in the
// library redirects to its real page instead.
const IgdbGamePreviewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { igdbId: igdbIdParam } = useParams<{ igdbId: string }>();
  const igdbId = Number(igdbIdParam);
  const { data: preview, isLoading, error } = useIgdbGamePreview(igdbId);
  const importGameMutation = useImportGame();

  if (!Number.isFinite(igdbId) || (isAxiosError(error) && error.response?.status === 404)) {
    return (
      <NotFoundPage
        title={t("games.preview.notFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.addGame") })}
        actionTo="/games/add"
      />
    );
  }

  if (error) {
    const notConfigured = isAxiosError(error) && error.response?.status === 503;
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {notConfigured ? t("games.add.igdbNotConfigured") : t("games.preview.loadError")}
      </Alert>
    );
  }

  if (isLoading || !preview) {
    return (
      <Stack sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (preview.localGame) {
    return <Navigate replace to={`/game/${gameIdentifier(preview.localGame)}`} />;
  }

  const handleAddGame = async () => {
    try {
      const game = await importGameMutation.mutateAsync(igdbId);
      toast.success(t("games.preview.addedToast", { name: game.name }), TOAST_OPTIONS);
      navigate(`/game/${gameIdentifier(game)}`, { replace: true });
    } catch (addError) {
      console.error("Error adding game:", addError);
      toast.error(t("games.add.addGameError"), TOAST_OPTIONS);
    }
  };

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          <GameCoverCard game={preview} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            {t("games.preview.notInLibrary")}
          </Typography>
          <Button
            variant="contained"
            startIcon={
              importGameMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AddIcon />
              )
            }
            disabled={importGameMutation.isPending}
            onClick={() => void handleAddGame()}
            fullWidth
          >
            {t("games.actions.addGameButton")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            fullWidth
          >
            {t("games.preview.backToSearch")}
          </Button>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={sectionCardSx}>
          <GameAboutSection game={preview} preview />
        </Card>
      </Grid>
    </Grid>
  );
};

export default IgdbGamePreviewPage;
