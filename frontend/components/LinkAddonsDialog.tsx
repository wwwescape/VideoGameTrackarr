import { useEffect, useState } from "react";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LinkIcon from "@mui/icons-material/Link";
import SearchIcon from "@mui/icons-material/Search";
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
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  useAddAddonLinks,
  useAddonLinkCandidates,
  useBaseGameAddons,
  useLinkBaseGameAddons,
} from "../hooks/useAddonLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { TOAST_OPTIONS } from "../utils/toastOptions";

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
  // Already linked as Included (shown on a linked row).
  linkedIncluded: boolean;
  // Starts as Included when ticked (IGDB lists it in this edition's bundle contents).
  suggestedIncluded: boolean;
  willBeAdded: boolean;
}

interface Group {
  key: string;
  title: string;
  rows: Row[];
}

const releaseYear = (timestamp: number | null) =>
  timestamp ? new Date(timestamp * 1000).getUTCFullYear() : null;

// Ticked rows by id, each with whether it's to be linked as Included.
type Selection = ReadonlyMap<number, boolean>;

const withToggled = (selection: Selection, row: Row): Selection => {
  const next = new Map(selection);
  if (next.has(row.id)) next.delete(row.id);
  else next.set(row.id, row.suggestedIncluded);
  return next;
};

const withIncluded = (selection: Selection, id: number, included: boolean): Selection =>
  new Map(selection).set(id, included);

const includedIds = (selection: Selection) =>
  [...selection].filter(([, included]) => included).map(([id]) => id);

// The link picker. On a game: the base game's add-ons from IGDB first (when it's an edition),
// then add-ons in VGT from the same Collection, then the same Series. On an add-on: games from
// the same Collection, then Series. Everything ticked is linked with one button; already-linked
// rows show ticked and disabled, so it's clear why they can't be picked. A ticked row also offers
// Works with | Included: Included means the add-on is part of that game (an edition that comes
// with it), so owning the game counts as owning the add-on.
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
        linkedIncluded: candidate.linkedIncluded,
        suggestedIncluded: false,
        willBeAdded: false,
      })
    );
  const sameCollection = new Set(
    (candidates.data ?? []).filter((c) => c.sameCollection).map((c) => c.id)
  );

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
        linkedIncluded: addon.included,
        suggestedIncluded: addon.suggestedIncluded,
        willBeAdded: addon.gameId === null,
      })),
    },
    {
      key: "collection",
      title: t("games.addonLinks.sameCollection"),
      rows: libraryRows.filter((row) => sameCollection.has(row.id)),
    },
    {
      key: "series",
      title: t("games.addonLinks.sameSeries"),
      rows: libraryRows.filter((row) => !sameCollection.has(row.id)),
    },
  ].filter((group) => group.rows.length > 0);

  const selectionFor = (row: Row) => (row.source === "igdb" ? selectedIgdb : selectedLibrary);
  const isSelected = (row: Row) => selectionFor(row).has(row.id);
  const toggle = (row: Row) => {
    if (row.source === "igdb") setSelectedIgdb((previous) => withToggled(previous, row));
    else setSelectedLibrary((previous) => withToggled(previous, row));
  };
  const setRowIncluded = (row: Row, included: boolean) => {
    if (row.source === "igdb")
      setSelectedIgdb((previous) => withIncluded(previous, row.id, included));
    else setSelectedLibrary((previous) => withIncluded(previous, row.id, included));
  };

  const handleLink = async () => {
    const libraryIds = [...selectedLibrary.keys()];
    const igdbIds = [...selectedIgdb.keys()];
    let linked = 0;
    let failed = 0;
    try {
      if (libraryIds.length > 0) {
        await addLinks.mutateAsync({ ids: libraryIds, includedIds: includedIds(selectedLibrary) });
        linked += libraryIds.length;
      }
      if (igdbIds.length > 0) {
        const results = await linkBase.mutateAsync({
          igdbIds,
          includedIgdbIds: includedIds(selectedIgdb),
        });
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
        <TextField
          size="small"
          fullWidth
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("games.addonLinks.searchPlaceholder")}
          slotProps={{
            htmlInput: { "aria-label": t("games.addonLinks.searchLabel") },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {fetching ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                </InputAdornment>
              ),
            },
          }}
          sx={{ flexShrink: 0 }}
        />
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
                      const included = selectionFor(row).get(row.id) ?? false;
                      return (
                        <ListItem
                          key={row.key}
                          disablePadding
                          secondaryAction={
                            row.linked ? (
                              <RelationLabel included={row.linkedIncluded} />
                            ) : selected ? (
                              <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={included ? "included" : "works-with"}
                                disabled={busy}
                                onChange={(_event, value: string | null) => {
                                  if (value) setRowIncluded(row, value === "included");
                                }}
                                aria-label={t("games.addonLinks.relationLabel", { name: row.name })}
                              >
                                <ToggleButton value="works-with" sx={{ gap: 0.5, px: 1, py: 0.25 }}>
                                  <LinkIcon fontSize="small" />
                                  {t("games.addonLinks.worksWithOption")}
                                </ToggleButton>
                                <ToggleButton value="included" sx={{ gap: 0.5, px: 1, py: 0.25 }}>
                                  <Inventory2OutlinedIcon fontSize="small" />
                                  {t("games.addonLinks.includedOption")}
                                </ToggleButton>
                              </ToggleButtonGroup>
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
                            sx={{ borderRadius: 1, pr: { xs: 18, sm: 30 } }}
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

// A linked row's current relation, in place of the toggle.
const RelationLabel = ({ included }: { included: boolean }) => {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      icon={included ? <Inventory2OutlinedIcon /> : <LinkIcon />}
      label={t(included ? "games.addonLinks.alreadyIncluded" : "games.addonLinks.alreadyLinked")}
    />
  );
};

export default LinkAddonsDialog;
