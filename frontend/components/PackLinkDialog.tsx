import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { PackCandidate } from "../api/addonLinks";
import { useAddPackLinks, usePackCandidates } from "../hooks/useAddonLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import PickerSearchField from "./PickerSearchField";

interface PackLinkDialogProps {
  open: boolean;
  gameId: number;
  gameName: string;
  // On a pack the picker lists add-ons to put inside it; on any other add-on, packs to put it in.
  isPack: boolean;
  onClose: () => void;
}

const releaseYear = (timestamp: number | null) =>
  timestamp ? new Date(timestamp * 1000).getUTCFullYear() : null;

// The pack picker: add-ons (or packs) for the editions of the same game, grouped by edition.
// Everything ticked is added with one button, always as Included: a pack's contents come with
// it. Rows already in place show ticked and disabled.
const PackLinkDialog = ({ open, gameId, gameName, isPack, onClose }: PackLinkDialogProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const candidates = usePackCandidates(gameId, debouncedSearch, open);
  const addLinks = useAddPackLinks(gameId);

  // A fresh picker each time it opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const toggle = (candidate: PackCandidate) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });

  // Grouped by the edition each is for; the server sends them in that order.
  const groups: { key: string; title: string; rows: PackCandidate[] }[] = [];
  for (const candidate of candidates.data ?? []) {
    const key = candidate.edition ? String(candidate.edition.id) : "none";
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(candidate);
    else groups.push({ key, title: candidate.edition?.name ?? "", rows: [candidate] });
  }

  const handleAdd = async () => {
    const ids = [...selected];
    try {
      await addLinks.mutateAsync(ids);
    } catch (error) {
      console.error("Error adding to pack:", error);
      toast.error(t("games.packs.addError"), TOAST_OPTIONS);
      return;
    }
    toast.success(
      t(isPack ? "games.packs.addedContentsToast" : "games.packs.addedPacksToast", {
        count: ids.length,
        name: gameName,
      }),
      TOAST_OPTIONS
    );
    onClose();
  };

  const busy = addLinks.isPending;
  const count = selected.size;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t(isPack ? "games.packs.pickContentsTitle" : "games.packs.pickPacksTitle")}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
          {t(isPack ? "games.packs.pickContentsHelp" : "games.packs.pickPacksHelp", {
            name: gameName,
          })}
        </Typography>
        <PickerSearchField value={search} onChange={setSearch} fetching={candidates.isFetching} />
        {/* Only the list scrolls; minHeight: 0 lets it shrink inside the flex column. */}
        <Box sx={{ flexGrow: 1, minHeight: 0, maxHeight: 440, overflowY: "auto", mt: 1.5 }}>
          {candidates.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : groups.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {debouncedSearch
                ? t("games.addonLinks.noMatches")
                : t(isPack ? "games.packs.noContentsCandidates" : "games.packs.noPackCandidates")}
            </Typography>
          ) : (
            <List dense disablePadding>
              {groups.map(({ key, title, rows }) => (
                <li key={key}>
                  <ul style={{ padding: 0 }}>
                    {title ? (
                      <ListSubheader sx={{ lineHeight: "32px", bgcolor: "background.paper" }}>
                        {title}
                      </ListSubheader>
                    ) : null}
                    {rows.map((row) => {
                      const year = releaseYear(row.firstReleaseDate);
                      return (
                        <ListItem
                          key={row.id}
                          disablePadding
                          secondaryAction={
                            row.linked ? (
                              <Chip
                                size="small"
                                label={t(
                                  isPack ? "games.packs.alreadyInside" : "games.packs.alreadyInPack"
                                )}
                              />
                            ) : null
                          }
                          sx={{ "& .MuiListItemSecondaryAction-root": { right: 8 } }}
                        >
                          <ListItemButton
                            disabled={row.linked || busy}
                            onClick={() => toggle(row)}
                            sx={{ borderRadius: 1, pr: row.linked ? 16 : 2 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Checkbox
                                edge="start"
                                size="small"
                                checked={row.linked || selected.has(row.id)}
                                disabled={row.linked || busy}
                                tabIndex={-1}
                                disableRipple
                                slotProps={{ input: { "aria-label": row.name } }}
                              />
                            </ListItemIcon>
                            <Avatar
                              variant="rounded"
                              src={row.coverUrl ?? undefined}
                              alt=""
                              sx={{ width: 30, height: 40, mr: 1.5 }}
                            />
                            <ListItemText
                              primary={row.name}
                              secondary={year !== null ? String(year) : undefined}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleAdd()}
          disabled={count === 0 || busy}
          startIcon={
            busy ? (
              <CircularProgress size={16} color="inherit" aria-label={t("common.working")} />
            ) : undefined
          }
        >
          {count === 0
            ? t("games.packs.addButtonEmpty")
            : t(isPack ? "games.packs.addContentsButton" : "games.packs.addPacksButton", { count })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PackLinkDialog;
