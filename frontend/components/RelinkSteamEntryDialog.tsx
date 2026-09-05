import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
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
import type { SteamEntry, SteamWishlistEntry } from "../api/integrations";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGames } from "../hooks/useGames";
import { useRelinkSteamEntry, useRelinkSteamWishlistEntry } from "../hooks/useIntegrations";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import GameCard from "./GameCard";

const MIN_SEARCH_LENGTH = 2;

export type RelinkTarget =
  | { source: "owned"; entry: SteamEntry }
  | { source: "wishlist"; entry: SteamWishlistEntry };

interface RelinkSteamEntryDialogProps {
  target: RelinkTarget | null;
  onClose: () => void;
}

// Searches VGT's own local library, not IGDB (see LinkToIgdbDialog.tsx for that) — relinking
// picks an *existing* catalog entry to repoint a Steam match at, it never creates one.
const RelinkSteamEntryDialog = ({ target, onClose }: RelinkSteamEntryDialogProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const relinkEntry = useRelinkSteamEntry();
  const relinkWishlistEntry = useRelinkSteamWishlistEntry();
  const isPending = relinkEntry.isPending || relinkWishlistEntry.isPending;

  useEffect(() => {
    if (target) setQuery(target.entry.gameName ?? target.entry.steamName);
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
      if (target.source === "owned") {
        await relinkEntry.mutateAsync({ steamAppId: target.entry.steamAppId, gameId });
      } else {
        await relinkWishlistEntry.mutateAsync({ steamAppId: target.entry.steamAppId, gameId });
      }
      toast.success(t("insights.steamSync.relinkSuccessToast"), TOAST_OPTIONS);
      onClose();
    } catch (error) {
      console.error(`Error relinking Steam app ${target.entry.steamAppId}:`, error);
      const message =
        isAxiosError(error) && error.response?.status === 409
          ? t("insights.steamSync.relinkConflictError")
          : t("insights.steamSync.relinkErrorToast");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  return (
    <Dialog open={target !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("insights.steamSync.relinkDialogTitle")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TextField
          label={t("insights.steamSync.relinkSearchLabel")}
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
            <Typography color="text.secondary">{t("insights.steamSync.relinkKeepTyping")}</Typography>
          ) : results && results.length === 0 ? (
            <Typography color="text.secondary">{t("insights.steamSync.relinkEmptyState")}</Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5 }}>
              {(results ?? []).map((game) => (
                <GameCard key={game.id} game={game} context="add" contextFunction={() => void handlePick(game.id)} />
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

export default RelinkSteamEntryDialog;
