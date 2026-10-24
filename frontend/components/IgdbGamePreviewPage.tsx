import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useImportGame } from "../hooks/useGames";
import { useIgdbGamePreview } from "../hooks/useIgdbSearch";
import { gameIdentifier } from "../utils/identifiers";
import { useStepBack } from "../utils/navState";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { GameAboutBlock, GameHero, GameMediaSections } from "./GameDetailParts";
import NotFoundPage from "./NotFoundPage";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";

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
  const routeCrumbs = useRouteCrumbs();
  const stepBack = useStepBack();

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
      <Page>
        <Alert severity="error">
          {notConfigured ? t("games.add.igdbNotConfigured") : t("games.preview.loadError")}
        </Alert>
      </Page>
    );
  }

  if (isLoading || !preview) {
    return (
      <Page>
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress />
        </Stack>
      </Page>
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
    <Page
      crumbs={[]}
      toolbar={
        <>
          <ToolbarButton
            icon={<ArrowBackIcon />}
            label={t("games.preview.backToSearch")}
            onClick={() => stepBack("/games/add")}
          />
          <ToolbarDivider />
          <ToolbarButton
            primary
            icon={importGameMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            label={t("games.actions.addGameButton")}
            disabled={importGameMutation.isPending}
            onClick={() => void handleAddGame()}
          />
          <Box component="span" sx={{ px: 1, color: "text.secondary", fontSize: 13, whiteSpace: "nowrap" }}>
            {t("games.preview.notInLibrary")}
          </Box>
        </>
      }
      hero={<GameHero game={preview} status={{ coverUrl: preview.coverUrl }} crumbs={routeCrumbs.slice(0, -1)} preview />}
    >
      <GameAboutBlock game={preview} />
      <GameMediaSections game={preview} />
    </Page>
  );
};

export default IgdbGamePreviewPage;
