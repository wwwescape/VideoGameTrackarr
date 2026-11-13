import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import LinkIcon from "@mui/icons-material/Link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GogEntry } from "../api/integrations";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames } from "../hooks/useGames";
import { useRelinkGogEntry } from "../hooks/useIntegrations";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import GameCard from "./GameCard";

const MIN_SEARCH_LENGTH = 2;

export type RelinkGogTarget = { entry: GogEntry };

interface RelinkGogEntryDialogProps {
  target: RelinkGogTarget | null;
  onClose: () => void;
}

// Searches VGT's own local library, not IGDB — relinking picks an *existing* catalog
// entry to repoint a GOG match at, it never creates one.
const RelinkGogEntryDialog = ({ target, onClose }: RelinkGogEntryDialogProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const relinkEntry = useRelinkGogEntry();
  const isPending = relinkEntry.isPending;

  useEffect(() => {
    if (target) setQuery(target.entry.gameName ?? target.entry.gogName);
  }, [target]);

  const debouncedQuery = useDebouncedValue(query.trim(), 500);
  const isSearchActive = debouncedQuery.length >= MIN_SEARCH_LENGTH;
  const { data: results, isFetching } = useGames(
    { search: debouncedQuery },
    { enabled: isSearchActive }
  );

  const handlePick = async (gameId: number) => {
    if (!target) return;
    try {
      await relinkEntry.mutateAsync({ gogProductId: target.entry.gogProductId, gameId });
      toast.success(t("insights.gogSync.relinkSuccessToast"), TOAST_OPTIONS);
      onClose();
    } catch (error) {
      console.error(`Error relinking GOG product ${target.entry.gogProductId}:`, error);
      const message =
        isAxiosError(error) && error.response?.status === 409
          ? t("insights.gogSync.relinkConflictError")
          : t("insights.gogSync.relinkErrorToast");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  return (
    <Dialog open={target !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("insights.gogSync.relinkDialogTitle")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TextField
          label={t("insights.gogSync.relinkSearchLabel")}
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={isPending}
          sx={{ flexShrink: 0, mb: 2 }}
        />
        <Box sx={{ flexGrow: 1, flexShrink: 1, minHeight: 0, maxHeight: 420, overflowY: "auto" }}>
          {isFetching ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : !isSearchActive ? (
            <Typography color="text.secondary">{t("insights.gogSync.relinkKeepTyping")}</Typography>
          ) : results && results.length === 0 ? (
            <Typography color="text.secondary">{t("insights.gogSync.relinkEmptyState")}</Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5 }}>
              {(results ?? []).map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  context="add"
                  contextFunction={() => void handlePick(game.id)}
                  actionLabel={t("insights.gogSync.relinkPickButton")}
                  actionIcon={<LinkIcon />}
                />
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          {t("common.cancel")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RelinkGogEntryDialog;
