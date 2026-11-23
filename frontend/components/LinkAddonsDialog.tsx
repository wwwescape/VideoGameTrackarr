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
import {
  useAddAddonLinks,
  useAddonLinkCandidates,
  useBaseGameAddons,
  useLinkBaseGameAddons,
} from "../hooks/useAddonLinks";
import type { AddonRelation } from "../api/addonLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

import { TOAST_OPTIONS } from "../utils/toastOptions";
import { RelationChip, RelationToggle } from "./AddonRelationControls";
import PickerSearchField from "./PickerSearchField";

interface LinkAddonsDialogProps {
  open: boolean;
  gameId: number;
  gameName: string;
  // From an add-on the picker lists games; from a game it lists add-ons.
  isAddon: boolean;
  // A game imported from IGDB can also take add-ons from its base game (e.g. FH5 Premium ->
  // Forza Horizon 5's add-ons), read live from IGDB.
  offerBaseGameAddons?: boolean;
  onClose: () => void;
}

// One pickable row: a game or add-on already in VGT (by its id), or a base-game add-on from
// IGDB (by its IGDB id), which may not be in VGT yet.
interface Row {
  key: string;
  source: "library" | "igdb";
  id: number;
  name: string;
  coverUrl: string | null;
  firstReleaseDate: number | null;
  linked: boolean;
  // How an already-linked row goes with this game (shown on it).
  linkedRelation: AddonRelation;
  // What a ticked row starts as: Included when IGDB lists it in this edition's bundle contents.
  suggestedRelation: AddonRelation;
  willBeAdded: boolean;
}

interface Group {
  key: string;
  title: string;
  rows: Row[];
}

const releaseYear = (timestamp: number | null) =>
  timestamp ? new Date(timestamp * 1000).getUTCFullYear() : null;

// Ticked rows by id, each with how it's to be linked.
type Selection = ReadonlyMap<number, AddonRelation>;

const withToggled = (selection: Selection, row: Row): Selection => {
  const next = new Map(selection);
  if (next.has(row.id)) next.delete(row.id);
  else next.set(row.id, row.suggestedRelation);
  return next;
};

const withRelation = (selection: Selection, id: number, relation: AddonRelation): Selection =>
  new Map(selection).set(id, relation);

const idsWith = (selection: Selection, relation: AddonRelation) =>
  [...selection].filter(([, chosen]) => chosen === relation).map(([id]) => id);

const relationIds = (selection: Selection) => ({
  includedIds: idsWith(selection, "included"),
  preorderBonusIds: idsWith(selection, "preorder_bonus"),
});

// The link picker, kept to editions of the same game (FH5, its Deluxe and Premium editions). On
// a game: the base game's add-ons from IGDB first (when it's an edition), then the other
// editions' add-ons in VGT, grouped by edition. On an add-on: the other editions of its game.
// Everything ticked is linked with one button; already-linked rows show ticked and disabled, so
// it's clear why they can't be picked. A ticked row also offers Works with | Included | Pre-order
// bonus: Included means the add-on is part of that game (owning the game owns the add-on); a
// pre-order bonus is only a label.
const LinkAddonsDialog = ({
  open,
  gameId,
  gameName,
  isAddon,
  offerBaseGameAddons = false,
  onClose,
}: LinkAddonsDialogProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedLibrary, setSelectedLibrary] = useState<Selection>(new Map());
  const [selectedIgdb, setSelectedIgdb] = useState<Selection>(new Map());
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const candidates = useAddonLinkCandidates(gameId, debouncedSearch, open);
  const baseGame = useBaseGameAddons(gameId, open && offerBaseGameAddons && !isAddon);
  const addLinks = useAddAddonLinks(gameId);
  const linkBase = useLinkBaseGameAddons(gameId);

  // A fresh picker each time it opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedLibrary(new Map());
      setSelectedIgdb(new Map());
    }
  }, [open]);

  const needle = debouncedSearch.toLowerCase();
  const baseAddons = (baseGame.data?.addons ?? []).filter((addon) =>
    addon.name.toLowerCase().includes(needle)
  );
  // A base-game add-on already in VGT is offered once, in the base-game group.
  const inBaseGroup = new Set(
    baseAddons.map((addon) => addon.gameId).filter((id): id is number => id !== null)
  );
  const editionOf = new Map(
    (candidates.data ?? []).map((candidate) => [candidate.id, candidate.edition])
  );
  const libraryRows: Row[] = (candidates.data ?? [])
    .filter((candidate) => !inBaseGroup.has(candidate.id))
    .map(
      (candidate): Row => ({
        key: `library-${candidate.id}`,
        source: "library",
        id: candidate.id,
        name: candidate.name,
        coverUrl: candidate.coverUrl,
        firstReleaseDate: candidate.firstReleaseDate,
        linked: candidate.linked,
        linkedRelation: candidate.linkedRelation,
        suggestedRelation: "works_with",
        willBeAdded: false,
      })
    );

  // On a game: the base game's add-ons from IGDB first, then add-ons in VGT by the edition
  // they're for. On an add-on: the other editions of its game.
  const editionGroups: Group[] = [];
  for (const row of libraryRows) {
    const edition = editionOf.get(row.id) ?? null;
    const key = edition ? `edition-${edition.id}` : "editions";
    let group = editionGroups.find((candidate) => candidate.key === key);
    if (!group) {
      group = {
        key,
        title: edition ? edition.name : t("games.addonLinks.otherEditions"),
        rows: [],
      };
      editionGroups.push(group);
    }
    group.rows.push(row);
  }

  const groups: Group[] = [
    {
      key: "base",
      title: t("games.addonLinks.fromBaseGame", { name: baseGame.data?.baseGame?.name ?? "" }),
      rows: baseAddons.map((addon) => ({
        key: `igdb-${addon.igdbId}`,
        source: "igdb" as const,
        id: addon.igdbId,
        name: addon.name,
        coverUrl: addon.coverUrl,
        firstReleaseDate: addon.firstReleaseDate,
        linked: addon.linked,
        linkedRelation: addon.relation,
        suggestedRelation: (addon.suggestedIncluded ? "included" : "works_with") as AddonRelation,
        willBeAdded: addon.gameId === null,
      })),
    },
    ...editionGroups,
  ].filter((group) => group.rows.length > 0);

  const selectionFor = (row: Row) => (row.source === "igdb" ? selectedIgdb : selectedLibrary);
  const isSelected = (row: Row) => selectionFor(row).has(row.id);
  const toggle = (row: Row) => {
    if (row.source === "igdb") setSelectedIgdb((previous) => withToggled(previous, row));
    else setSelectedLibrary((previous) => withToggled(previous, row));
  };
  const setRowRelation = (row: Row, relation: AddonRelation) => {
    if (row.source === "igdb")
      setSelectedIgdb((previous) => withRelation(previous, row.id, relation));
    else setSelectedLibrary((previous) => withRelation(previous, row.id, relation));
  };

  const handleLink = async () => {
    const libraryIds = [...selectedLibrary.keys()];
    const igdbIds = [...selectedIgdb.keys()];
    let linked = 0;
    let failed = 0;
    try {
      if (libraryIds.length > 0) {
        await addLinks.mutateAsync({ ids: libraryIds, ...relationIds(selectedLibrary) });
        linked += libraryIds.length;
      }
      if (igdbIds.length > 0) {
        const results = await linkBase.mutateAsync({ igdbIds, ...relationIds(selectedIgdb) });
        failed = results.filter((result) => result.status === "failed").length;
        linked += results.length - failed;
      }
    } catch (error) {
      console.error("Error linking add-ons:", error);
      toast.error(t("games.addonLinks.linkError"), TOAST_OPTIONS);
      return;
    }
    if (linked > 0) {
      toast.success(
        t(isAddon ? "games.addonLinks.linkedGamesToast" : "games.addonLinks.linkedAddonsToast", {
          count: linked,
          name: gameName,
        }),
        TOAST_OPTIONS
      );
    }
    if (failed > 0) {
      toast.error(t("games.addonLinks.someFailed", { count: failed }), TOAST_OPTIONS);
    }
    // Stay open only when nothing worked, so the picks can be retried.
    if (linked > 0) onClose();
  };

  const busy = addLinks.isPending || linkBase.isPending;
  const count = selectedLibrary.size + selectedIgdb.size;
  const loading = candidates.isLoading || (baseGame.isLoading && baseGame.fetchStatus !== "idle");
  const fetching = candidates.isFetching || baseGame.isFetching;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t(isAddon ? "games.addonLinks.pickGamesTitle" : "games.addonLinks.pickAddonsTitle")}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
          {t(isAddon ? "games.addonLinks.pickGamesHelp" : "games.addonLinks.pickAddonsHelp", {
            name: gameName,
          })}
        </Typography>
        <PickerSearchField value={search} onChange={setSearch} fetching={fetching} />
        {/* Only the list scrolls; minHeight: 0 lets it shrink inside the flex column. */}
        <Box sx={{ flexGrow: 1, minHeight: 0, maxHeight: 440, overflowY: "auto", mt: 1.5 }}>
          {loading && groups.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : groups.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {debouncedSearch
                ? t("games.addonLinks.noMatches")
                : t(
                    isAddon
                      ? "games.addonLinks.noGameCandidates"
                      : "games.addonLinks.noAddonCandidates"
                  )}
            </Typography>
          ) : (
            <List dense disablePadding>
              {groups.map((group) => (
                <li key={group.key}>
                  <ul style={{ padding: 0 }}>
                    <ListSubheader sx={{ lineHeight: "32px", bgcolor: "background.paper" }}>
                      {group.title}
                    </ListSubheader>
                    {group.rows.map((row) => {
                      const selected = isSelected(row);
                      const year = releaseYear(row.firstReleaseDate);
                      const importing = busy && selected && row.source === "igdb";
                      const relation = selectionFor(row).get(row.id) ?? "works_with";
                      return (
                        <ListItem
                          key={row.key}
                          disablePadding
                          secondaryAction={
                            row.linked ? (
                              <RelationChip relation={row.linkedRelation} />
                            ) : selected ? (
                              <RelationToggle
                                value={relation}
                                disabled={busy}
                                onChange={(next) => setRowRelation(row, next)}
                                label={t("games.addonLinks.relationLabel", { name: row.name })}
                              />
                            ) : row.willBeAdded ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t("games.addonLinks.willBeAdded")}
                              />
                            ) : null
                          }
                          sx={{ "& .MuiListItemSecondaryAction-root": { right: 8 } }}
                        >
                          <ListItemButton
                            disabled={row.linked || busy}
                            onClick={() => toggle(row)}
                            sx={{ borderRadius: 1, pr: { xs: 18, sm: 46 } }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {importing ? (
                                <CircularProgress
                                  size={18}
                                  sx={{ ml: 0.25 }}
                                  aria-label={t("common.working")}
                                />
                              ) : (
                                <Checkbox
                                  edge="start"
                                  size="small"
                                  checked={row.linked || selected}
                                  disabled={row.linked || busy}
                                  tabIndex={-1}
                                  disableRipple
                                  slotProps={{ input: { "aria-label": row.name } }}
                                />
                              )}
                            </ListItemIcon>
                            <Avatar
                              variant="rounded"
                              src={row.coverUrl ?? undefined}
                              alt=""
                              sx={{ width: 30, height: 40, mr: 1.5 }}
                            />
                            <ListItemText
                              primary={row.name}
                              secondary={
                                [
                                  year !== null ? String(year) : null,
                                  selected && row.willBeAdded
                                    ? t("games.addonLinks.willBeAdded")
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || undefined
                              }
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
          onClick={() => void handleLink()}
          disabled={count === 0 || busy}
          startIcon={
            busy ? (
              <CircularProgress size={16} color="inherit" aria-label={t("common.working")} />
            ) : undefined
          }
        >
          {count === 0
            ? t("games.addonLinks.linkButtonEmpty")
            : t(
                isAddon ? "games.addonLinks.linkGamesButton" : "games.addonLinks.linkAddonsButton",
                { count }
              )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkAddonsDialog;
