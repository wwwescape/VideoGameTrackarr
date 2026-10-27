import { Fragment, useMemo, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestoreIcon from "@mui/icons-material/Restore";
import SyncIcon from "@mui/icons-material/Sync";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getSteamStoreDetails,
  type IgnoreResult,
  type SteamEntry,
  type SteamEntryStatus,
  type SteamWishlistEntry,
  type SteamWishlistEntryStatus,
  type SyncResult,
} from "../api/integrations";
import {
  useIgnoreSteamEntries,
  useIgnoreSteamEntry,
  useIgnoreSteamWishlistEntries,
  useIgnoreSteamWishlistEntry,
  useSteamEntries,
  useSteamWishlistEntries,
  useSyncSteamEntries,
  useSyncSteamWishlistEntries,
  useUnignoreSteamEntry,
  useUnignoreSteamWishlistEntry,
  useUnlinkSteamEntry,
  useUnlinkSteamWishlistEntry,
} from "../hooks/useIntegrations";
import { useJobsList, useRunJob } from "../hooks/useJobs";
import { useListSort } from "../hooks/useListSort";
import { useSessionState } from "../hooks/useSessionState";
import { sortRows, type SortField } from "../utils/listSort";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { SortHeaderCell } from "./ListControls";
import RelinkSteamEntryDialog, { type RelinkTarget } from "./RelinkSteamEntryDialog";
import SettingsFrame from "./SettingsFrame";
import { ToolbarButton } from "./Page";

const STEAM_IMPORT_JOB_ID = "steam_import";

type SyncRow =
  | { source: "owned"; entry: SteamEntry }
  | { source: "wishlist"; entry: SteamWishlistEntry };

interface TreeRow {
  row: SyncRow;
  children: SyncRow[];
}

interface SyncTarget {
  source: "owned" | "wishlist";
  entry: SteamEntry | SteamWishlistEntry;
  childCount: number;
}

const rowKey = (row: SyncRow) => `${row.source}:${row.entry.steamAppId}`;
const rowName = (row: SyncRow) => row.entry.gameName ?? row.entry.steamName;

const isRowActionable = (row: SyncRow) =>
  row.source === "owned"
    ? row.entry.status === "new" || row.entry.status === "update_available"
    : row.entry.status === "new";

// Rows with nothing left to do — what "Hide synced" hides. No catalog match stays visible:
// those may still need "Add as custom game".
const isRowDone = (row: SyncRow) =>
  row.entry.status === "up_to_date" ||
  row.entry.status === "already_wishlisted" ||
  row.entry.status === "ignored";

const OWNED_STATUS_CHIP: Record<
  SteamEntryStatus,
  { color: "default" | "info" | "warning" | "success"; labelKey: string }
> = {
  no_match: { color: "default", labelKey: "insights.steamSync.status.noMatch" },
  new: { color: "info", labelKey: "insights.steamSync.status.new" },
  update_available: { color: "warning", labelKey: "insights.steamSync.status.updateAvailable" },
  up_to_date: { color: "success", labelKey: "insights.steamSync.status.upToDate" },
  ignored: { color: "default", labelKey: "insights.steamSync.status.ignored" },
};

const WISHLIST_STATUS_CHIP: Record<
  SteamWishlistEntryStatus,
  { color: "default" | "info" | "success"; labelKey: string }
> = {
  no_match: { color: "default", labelKey: "insights.steamSync.status.noMatch" },
  new: { color: "info", labelKey: "insights.steamSync.status.new" },
  already_wishlisted: { color: "success", labelKey: "insights.steamSync.status.alreadyWishlisted" },
  ignored: { color: "default", labelKey: "insights.steamSync.status.ignored" },
};

const formatHours = (minutes: number) => (minutes / 60).toFixed(1);

type SyncSort = "name" | "steam_status" | "steam_playtime" | "vgt_playtime" | "vgt_status";

// The status chip's label key for a row (the VGT Status column).
const statusLabelKey = (row: SyncRow) =>
  row.source === "owned" ? OWNED_STATUS_CHIP[row.entry.status].labelKey : WISHLIST_STATUS_CHIP[row.entry.status].labelKey;

// Groups the combined owned+wishlist entry list into top-level rows + their DLC/expansion/
// pack children (matched via each entry's parentGameId). Nesting deliberately spans *both*
// sources — you commonly own a base game while a specific DLC pack for it only sits on your
// wishlist (or vice versa), so an owned parent can have wishlisted children and a wishlisted
// parent can have owned children; the two rows just keep whichever Steam Status/Playtime
// values actually belong to that specific entry. An entry whose parent isn't present in
// either list at all (or has no parent) is treated as its own top-level row.
function buildTrees(owned: SteamEntry[], wishlist: SteamWishlistEntry[]): TreeRow[] {
  const allRows: SyncRow[] = [
    ...owned.map((entry): SyncRow => ({ source: "owned", entry })),
    ...wishlist.map((entry): SyncRow => ({ source: "wishlist", entry })),
  ];

  const byGameId = new Map<number, SyncRow>();
  for (const row of allRows) {
    if (row.entry.gameId !== null) byGameId.set(row.entry.gameId, row);
  }

  const childrenByParent = new Map<number, SyncRow[]>();
  const topLevel: SyncRow[] = [];
  for (const row of allRows) {
    const parentGameId = row.entry.parentGameId;
    if (parentGameId !== null && byGameId.has(parentGameId)) {
      const siblings = childrenByParent.get(parentGameId) ?? [];
      siblings.push(row);
      childrenByParent.set(parentGameId, siblings);
    } else {
      topLevel.push(row);
    }
  }

  return topLevel.map((row) => ({
    row,
    children: row.entry.gameId !== null ? (childrenByParent.get(row.entry.gameId) ?? []) : [],
  }));
}

const SteamSyncPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: ownedEntries } = useSteamEntries();
  const { data: wishlistEntries } = useSteamWishlistEntries();
  const syncEntries = useSyncSteamEntries();
  const syncWishlistEntries = useSyncSteamWishlistEntries();
  const ignoreEntry = useIgnoreSteamEntry();
  const ignoreWishlistEntry = useIgnoreSteamWishlistEntry();
  const ignoreEntries = useIgnoreSteamEntries();
  const ignoreWishlistEntries = useIgnoreSteamWishlistEntries();
  const unignoreEntry = useUnignoreSteamEntry();
  const unignoreWishlistEntry = useUnignoreSteamWishlistEntry();
  const unlinkEntry = useUnlinkSteamEntry();
  const unlinkWishlistEntry = useUnlinkSteamWishlistEntry();
  const { data: jobs } = useJobsList();
  const runJob = useRunJob();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SyncTarget[] | null>(null);
  const [relinkTarget, setRelinkTarget] = useState<RelinkTarget | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SyncRow | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<SyncRow[] | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [hideSynced, setHideSynced] = useSessionState("steamSync.hideSynced", false);

  const isImporting = jobs?.find((job) => job.id === STEAM_IMPORT_JOB_ID)?.run.status === "running";

  const sortFields: SortField<SyncSort>[] = [
    { field: "name", label: t("insights.steamSync.columnName") },
    { field: "steam_status", label: t("insights.steamSync.columnSteamStatus") },
    { field: "steam_playtime", label: t("insights.steamSync.columnSteamPlaytime"), defaultDirection: "desc" },
    { field: "vgt_playtime", label: t("insights.steamSync.columnVgtPlaytime"), defaultDirection: "desc" },
    { field: "vgt_status", label: t("insights.steamSync.columnVgtStatus") },
  ];
  const sort = useListSort("steamSync.sortBy", sortFields, { field: "name", direction: "asc" });

  // Top-level rows in the sort's order; each one's add-ons stay under it.
  const trees = useMemo(
    () =>
      sortRows(
        buildTrees(ownedEntries ?? [], wishlistEntries ?? []),
        sort.sort,
        {
          name: (tree) => rowName(tree.row),
          steam_status: (tree) =>
            t(tree.row.source === "owned" ? "insights.steamSync.steamStatusOwned" : "insights.steamSync.steamStatusWishlisted"),
          steam_playtime: (tree) => (tree.row.source === "owned" ? tree.row.entry.steamPlaytimeMinutes : null),
          vgt_playtime: (tree) => (tree.row.source === "owned" ? tree.row.entry.vgtPlaytimeMinutes : null),
          vgt_status: (tree) => t(statusLabelKey(tree.row)),
        },
        (tree) => rowName(tree.row)
      ),
    [ownedEntries, wishlistEntries, sort.sort, t]
  );
  const header = (field: SyncSort, align?: "right") => (
    <SortHeaderCell
      field={field}
      align={align}
      sort={sort.sort}
      onSort={(next) => {
        sort.clickHeader(next);
        setPage(0);
      }}
    >
      {sortFields.find((option) => option.field === field)?.label}
    </SortHeaderCell>
  );

  // What the table pages over. With "Hide synced" on, done rows drop out — except a done
  // parent whose DLC still has something to sync, which stays so those children are reachable.
  const displayedTrees = useMemo(() => {
    if (!hideSynced) return trees;
    return trees
      .map((tree) => ({ row: tree.row, children: tree.children.filter((child) => !isRowDone(child)) }))
      .filter((tree) => !isRowDone(tree.row) || tree.children.length > 0);
  }, [trees, hideSynced]);

  // Clamped so the page never points past the end, e.g. once a sync makes rows disappear
  // while "Hide synced" is on.
  const lastPage = Math.max(0, Math.ceil(displayedTrees.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleTrees = displayedTrees.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);

  // Flattened top-level rows + their DLC children, across every page — used for resolving
  // "Sync selected" (a selection can span pages) into the actual rows to sync, and for the
  // Gmail-style "Select all N games" across every page.
  const allRows = useMemo(() => trees.flatMap((tree) => [tree.row, ...tree.children]), [trees]);
  const allActionableKeys = useMemo(() => allRows.filter(isRowActionable).map(rowKey), [allRows]);
  const selectedRows = allRows.filter((row) => selectedSet.has(rowKey(row)) && isRowActionable(row));
  const allActionableSelected =
    allActionableKeys.length > 0 && selectedRows.length === allActionableKeys.length;

  // Current page's rows only — this is what the header checkbox and "select all" operate over
  // (a paginated table selecting rows the user can't currently see would be surprising), but
  // still reaches into a page row's collapsed DLC children even when not expanded, so bulk-
  // syncing a game's whole DLC catalog doesn't require expanding each one first (see the
  // selectAllTooltip copy).
  const currentPageRows = useMemo(
    () => visibleTrees.flatMap((tree) => [tree.row, ...tree.children]),
    [visibleTrees]
  );
  const actionableCurrentPageRows = currentPageRows.filter(isRowActionable);
  const selectedOnCurrentPage = actionableCurrentPageRows.filter((row) => selectedSet.has(rowKey(row)));
  const currentPageFullySelected =
    actionableCurrentPageRows.length > 0 &&
    selectedOnCurrentPage.length === actionableCurrentPageRows.length;
  // Gmail-style: once a page is fully selected, offer to extend the selection to every
  // syncable row on every page (only worth offering when other pages have more).
  const showSelectAllNotice =
    currentPageFullySelected && allActionableKeys.length > actionableCurrentPageRows.length;
  // A page can hold nothing syncable at all (e.g. only up-to-date games) while other pages
  // still do — the header checkbox has nothing to tick there, so offer "Select all" directly.
  const showNothingOnPageNotice =
    !allActionableSelected && actionableCurrentPageRows.length === 0 && allActionableKeys.length > 0;

  // The currently *visible* (rendered) row order on this page — top-level rows plus any
  // expanded children, in on-screen order — used for shift-click range selection, since a
  // range only makes visual sense over what's actually on screen between the two clicks.
  const visibleOrderedRows = useMemo(() => {
    const list: SyncRow[] = [];
    for (const tree of visibleTrees) {
      list.push(tree.row);
      if (expanded.has(rowKey(tree.row))) list.push(...tree.children);
    }
    return list;
  }, [visibleTrees, expanded]);

  // A top-level row's own children count, looked up by gameId — used so a bulk sync of a
  // selected parent still surfaces the "N DLC will also sync" note (see confirmAddonNote)
  // even though children can now be selected/synced independently of their parent.
  const childCountByGameId = useMemo(() => {
    const map = new Map<number, number>();
    for (const tree of trees) {
      if (tree.row.entry.gameId !== null) map.set(tree.row.entry.gameId, tree.children.length);
    }
    return map;
  }, [trees]);
  const childCountFor = (row: SyncRow) =>
    row.entry.gameId !== null ? (childCountByGameId.get(row.entry.gameId) ?? 0) : 0;

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRow = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Gmail-style shift-click: extends the selection from the last-clicked row to this one,
  // over the currently *visible* row order (see visibleOrderedRows) — a range only makes
  // visual sense over what's actually on screen between the two clicks. The whole range takes
  // on the target checkbox's new state (its state *before* this click, inverted), matching how
  // a plain click on it would have behaved — so shift-clicking a checked box to uncheck it
  // unchecks the whole range too, not just checks it. Falls back to a plain toggle when there's
  // no anchor yet, or the anchor isn't on the current page (e.g. after paginating).
  const handleRowCheckboxClick = (row: SyncRow, event: React.MouseEvent) => {
    const key = rowKey(row);
    if (event.shiftKey && lastClickedKey) {
      const orderedKeys = visibleOrderedRows.filter(isRowActionable).map(rowKey);
      const anchorIndex = orderedKeys.indexOf(lastClickedKey);
      const targetIndex = orderedKeys.indexOf(key);
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeKeys = orderedKeys.slice(start, end + 1);
        const shouldSelect = !selectedSet.has(key);
        setSelected((prev) => {
          const withoutRange = prev.filter((k) => !rangeKeys.includes(k));
          return shouldSelect ? [...withoutRange, ...rangeKeys] : withoutRange;
        });
        setLastClickedKey(key);
        return;
      }
    }
    toggleRow(key);
    setLastClickedKey(key);
  };

  // Scoped to the current page only — reaching across pages to select rows the user can't see
  // would be surprising, so that takes the explicit "Select all N games" link in the toolbar.
  // Adds/removes just this page's actionable rows, leaving any selection on other pages
  // untouched (so paging through and selecting a few rows per page accumulates). Once
  // everything is selected, unticking clears the whole selection, as Gmail does.
  const toggleSelectAll = () => {
    if (allActionableSelected) {
      setSelected([]);
      return;
    }
    const pageKeys = actionableCurrentPageRows.map(rowKey);
    setSelected((prev) =>
      currentPageFullySelected
        ? prev.filter((k) => !pageKeys.includes(k))
        : [...new Set([...prev, ...pageKeys])]
    );
  };

  const handleRunImport = async () => {
    try {
      await runJob.mutateAsync(STEAM_IMPORT_JOB_ID);
    } catch (error) {
      console.error("Error running Steam import:", error);
      toast.error(t("insights.steamSync.importErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmSync = async () => {
    if (!confirmTarget) return;
    try {
      const ownedIds = confirmTarget.filter((t) => t.source === "owned").map((t) => t.entry.steamAppId);
      const wishlistIds = confirmTarget
        .filter((t) => t.source === "wishlist")
        .map((t) => t.entry.steamAppId);

      const emptyResult: SyncResult = { synced: 0, failed: 0, failures: [] };
      const [ownedResult, wishlistResult] = await Promise.all([
        ownedIds.length > 0 ? syncEntries.mutateAsync(ownedIds) : Promise.resolve(emptyResult),
        wishlistIds.length > 0 ? syncWishlistEntries.mutateAsync(wishlistIds) : Promise.resolve(emptyResult),
      ]);
      const synced = ownedResult.synced + wishlistResult.synced;
      const failed = ownedResult.failed + wishlistResult.failed;

      if (failed > 0) {
        toast.error(t("insights.steamSync.syncPartialErrorToast", { failed }), TOAST_OPTIONS);
      } else {
        toast.success(t("insights.steamSync.syncSuccessToast", { count: synced }), TOAST_OPTIONS);
      }
      setSelected([]);
    } catch (error) {
      console.error("Error syncing Steam entries:", error);
      toast.error(t("insights.steamSync.syncErrorToast"), TOAST_OPTIONS);
    } finally {
      setConfirmTarget(null);
    }
  };

  const handleIgnore = async (row: SyncRow) => {
    try {
      if (row.source === "owned") {
        await ignoreEntry.mutateAsync(row.entry.steamAppId);
      } else {
        await ignoreWishlistEntry.mutateAsync(row.entry.steamAppId);
      }
    } catch (error) {
      console.error(`Error ignoring Steam app ${row.entry.steamAppId}:`, error);
      toast.error(t("insights.steamSync.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  // An entry ignored before IGDB matched it comes back as No catalog match: the import job
  // skips matching ignored entries, so only the next Import can match it.
  const handleUnignore = async (row: SyncRow) => {
    try {
      const updated =
        row.source === "owned"
          ? await unignoreEntry.mutateAsync(row.entry.steamAppId)
          : await unignoreWishlistEntry.mutateAsync(row.entry.steamAppId);
      if (updated.status === "no_match") {
        toast.info(t("insights.steamSync.unignoreNoMatchToast"), TOAST_OPTIONS);
      }
    } catch (error) {
      console.error(`Error un-ignoring Steam app ${row.entry.steamAppId}:`, error);
      toast.error(t("insights.steamSync.unignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmBulkIgnore = async () => {
    if (!ignoreTarget) return;
    try {
      const ownedIds = ignoreTarget.filter((row) => row.source === "owned").map((row) => row.entry.steamAppId);
      const wishlistIds = ignoreTarget
        .filter((row) => row.source === "wishlist")
        .map((row) => row.entry.steamAppId);

      const emptyResult: IgnoreResult = { ignored: 0, failed: 0, failures: [] };
      const [ownedResult, wishlistResult] = await Promise.all([
        ownedIds.length > 0 ? ignoreEntries.mutateAsync(ownedIds) : Promise.resolve(emptyResult),
        wishlistIds.length > 0 ? ignoreWishlistEntries.mutateAsync(wishlistIds) : Promise.resolve(emptyResult),
      ]);
      const ignored = ownedResult.ignored + wishlistResult.ignored;
      const failed = ownedResult.failed + wishlistResult.failed;

      if (failed > 0) {
        toast.error(t("insights.steamSync.ignorePartialErrorToast", { failed }), TOAST_OPTIONS);
      } else {
        toast.success(t("insights.steamSync.ignoreSuccessToast", { count: ignored }), TOAST_OPTIONS);
      }
      setSelected([]);
    } catch (error) {
      console.error("Error ignoring Steam entries:", error);
      toast.error(t("insights.steamSync.ignoreBulkErrorToast"), TOAST_OPTIONS);
    } finally {
      setIgnoreTarget(null);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkTarget) return;
    try {
      if (unlinkTarget.source === "owned") {
        await unlinkEntry.mutateAsync(unlinkTarget.entry.steamAppId);
      } else {
        await unlinkWishlistEntry.mutateAsync(unlinkTarget.entry.steamAppId);
      }
      toast.success(t("insights.steamSync.unlinkSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error unlinking Steam app ${unlinkTarget.entry.steamAppId}:`, error);
      toast.error(t("insights.steamSync.unlinkErrorToast"), TOAST_OPTIONS);
    } finally {
      setUnlinkTarget(null);
    }
  };

  const handleAddAsCustomGame = async (row: SyncRow) => {
    try {
      const details = await getSteamStoreDetails(row.entry.steamAppId);
      navigate("/games/add", {
        state: {
          steamPrefill: {
            steamAppId: row.entry.steamAppId,
            name: details.name,
            coverUrl: details.coverUrl ?? undefined,
            summary: details.summary ?? undefined,
          },
        },
      });
    } catch (error) {
      console.error(`Error fetching Steam store details for app ${row.entry.steamAppId}:`, error);
      toast.error(t("insights.steamSync.storeDetailsErrorToast"), TOAST_OPTIONS);
    }
  };

  const confirmDescription = (() => {
    if (!confirmTarget) return "";
    const addonCount = confirmTarget.reduce((sum, target) => sum + target.childCount, 0);

    const base = (() => {
      if (confirmTarget.length === 1) {
        const [target] = confirmTarget;
        if (target.source === "wishlist") {
          return t("insights.steamSync.wishlist.confirmAddDescription", {
            name: target.entry.gameName ?? target.entry.steamName,
          });
        }
        const entry = target.entry as SteamEntry;
        return entry.status === "new"
          ? t("insights.steamSync.confirmAddDescription", {
              name: entry.gameName,
              hours: formatHours(entry.steamPlaytimeMinutes),
            })
          : t("insights.steamSync.confirmUpdateDescription", {
              name: entry.gameName,
              currentHours: formatHours(entry.vgtPlaytimeMinutes ?? 0),
              newHours: formatHours(entry.steamPlaytimeMinutes),
            });
      }

      const ownedNewCount = confirmTarget.filter(
        (t) => t.source === "owned" && (t.entry as SteamEntry).status === "new"
      ).length;
      const ownedUpdateCount = confirmTarget.filter(
        (t) => t.source === "owned" && (t.entry as SteamEntry).status === "update_available"
      ).length;
      const wishlistNewCount = confirmTarget.filter((t) => t.source === "wishlist").length;

      const parts: string[] = [];
      if (ownedNewCount > 0) {
        parts.push(t("insights.steamSync.confirmBulkOwnedNewPart", { count: ownedNewCount }));
      }
      if (ownedUpdateCount > 0) {
        parts.push(t("insights.steamSync.confirmBulkOwnedUpdatePart", { count: ownedUpdateCount }));
      }
      if (wishlistNewCount > 0) {
        parts.push(t("insights.steamSync.confirmBulkWishlistNewPart", { count: wishlistNewCount }));
      }
      return t("insights.steamSync.confirmBulkIntro", { list: parts.join(", ") });
    })();

    if (addonCount === 0) return base;
    return (
      <>
        {base}
        <br />
        {t("insights.steamSync.confirmAddonNote", { count: addonCount })}
      </>
    );
  })();

  const renderActions = (row: SyncRow, childCount = 0) => {
    const actionable = isRowActionable(row);
    return (
      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
        {actionable && (
          <Tooltip title={t("insights.steamSync.syncButton")}>
            <IconButton
              size="small"
              onClick={() => setConfirmTarget([{ source: row.source, entry: row.entry, childCount }])}
            >
              <SyncIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.entry.status === "no_match" && (
          <Tooltip title={t("insights.steamSync.addCustomButton")}>
            <IconButton size="small" onClick={() => void handleAddAsCustomGame(row)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.entry.gameId !== null && (
          <Tooltip title={t("insights.steamSync.relinkButton")}>
            <IconButton size="small" onClick={() => setRelinkTarget(row)}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.entry.gameId !== null && (
          <Tooltip title={t("insights.steamSync.unlinkButton")}>
            <IconButton size="small" onClick={() => setUnlinkTarget(row)}>
              <LinkOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.entry.status === "ignored" ? (
          <Tooltip title={t("insights.steamSync.unignoreButton")}>
            <IconButton size="small" onClick={() => void handleUnignore(row)}>
              <RestoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={t("insights.steamSync.ignoreButton")}>
            <IconButton size="small" onClick={() => void handleIgnore(row)}>
              <BlockIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  };

  const renderStatusChip = (row: SyncRow) => {
    if (row.source === "owned") {
      const chip = OWNED_STATUS_CHIP[row.entry.status];
      return <Chip size="small" color={chip.color} label={t(chip.labelKey)} />;
    }
    const chip = WISHLIST_STATUS_CHIP[row.entry.status];
    return <Chip size="small" color={chip.color} label={t(chip.labelKey)} />;
  };

  return (
    <SettingsFrame
      description={t("insights.steamSync.description")}
      toolbarEnd={
        <ToolbarButton
          primary
          icon={<PlayArrowIcon />}
          label={isImporting ? t("insights.steamSync.importRunning") : t("insights.steamSync.runImportButton")}
          onClick={() => void handleRunImport()}
          disabled={isImporting}
        />
      }
    >

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        <Toolbar
          sx={{
            pl: 2,
            pr: 1,
            flexWrap: "wrap",
            ...(selected.length > 0 && {
              bgcolor: alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
            }),
          }}
        >
          <Typography
            sx={{ flex: { xs: "1 1 auto", sm: "0 0 auto" } }}
            color="inherit"
            variant={selected.length > 0 ? "subtitle1" : "h6"}
          >
            {selected.length > 0
              ? t("insights.steamSync.selectedCount", { count: selected.length })
              : t("insights.steamSync.tableHeading")}
          </Typography>
          <Box
            sx={{
              // Its own full-width row under the count and Sync button on phones.
              flex: "1 1 auto",
              order: { xs: 1, sm: 0 },
              flexBasis: { xs: "100%", sm: "auto" },
              pb: { xs: 1, sm: 0 },
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              columnGap: 0.5,
              px: 1,
              textAlign: "center",
            }}
          >
            {allActionableSelected && allActionableKeys.length > actionableCurrentPageRows.length ? (
              <>
                <Typography variant="body2">
                  {t("insights.steamSync.allSelectedNotice", { count: allActionableKeys.length })}
                </Typography>
                <Button size="small" onClick={() => setSelected([])}>
                  {t("insights.steamSync.clearSelectionButton")}
                </Button>
              </>
            ) : showSelectAllNotice || showNothingOnPageNotice ? (
              <>
                <Typography variant="body2">
                  {showSelectAllNotice
                    ? t("insights.steamSync.pageSelectedNotice", {
                        count: actionableCurrentPageRows.length,
                      })
                    : t("insights.steamSync.nothingOnPageNotice")}
                </Typography>
                <Button size="small" onClick={() => setSelected(allActionableKeys)}>
                  {t("insights.steamSync.selectAllAcrossPagesButton", {
                    count: allActionableKeys.length,
                  })}
                </Button>
              </>
            ) : null}
          </Box>
          {selected.length > 0 ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                startIcon={<BlockIcon />}
                onClick={() => setIgnoreTarget(selectedRows)}
                disabled={
                  selectedRows.length === 0 || ignoreEntries.isPending || ignoreWishlistEntries.isPending
                }
              >
                {t("insights.steamSync.ignoreSelectedButton")}
              </Button>
              <Button
                startIcon={<SyncIcon />}
                onClick={() =>
                  setConfirmTarget(
                    selectedRows.map((row) => ({
                      source: row.source,
                      entry: row.entry,
                      childCount: childCountFor(row),
                    }))
                  )
                }
                disabled={
                  selectedRows.length === 0 || syncEntries.isPending || syncWishlistEntries.isPending
                }
              >
                {t("insights.steamSync.syncSelectedButton")}
              </Button>
            </Stack>
          ) : (
            <Tooltip title={t("insights.steamSync.hideSyncedTooltip")} describeChild>
              <FormControlLabel
                control={
                  <Switch
                    checked={hideSynced}
                    onChange={(event) => {
                      setHideSynced(event.target.checked);
                      setPage(0);
                    }}
                  />
                }
                label={t("insights.steamSync.hideSyncedLabel")}
                sx={{ flexShrink: 0, mr: 0 }}
              />
            </Tooltip>
          )}
        </Toolbar>

        {trees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.steamSync.emptyState")}
          </Box>
        ) : displayedTrees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.steamSync.allSyncedState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {/* MUI's own TableCell paddingCheckbox style zeroes out padding on its
                        *direct* child only ("& > *"), which is how a bare row Checkbox below
                        ends up sized down to just its icon. The Tooltip here needs to wrap a
                        span (so it still works while the checkbox is disabled), which makes the
                        Checkbox a grandchild instead — missing that rule and keeping its full
                        default padding, rendering visibly larger/misaligned than the row
                        checkboxes. Replicated explicitly here since the DOM nesting can't match
                        MUI's selector. */}
                    <Tooltip title={t("insights.steamSync.selectAllTooltip")}>
                      <span>
                        <Checkbox
                          indeterminate={
                            selectedOnCurrentPage.length > 0 && !currentPageFullySelected
                          }
                          checked={currentPageFullySelected}
                          onChange={toggleSelectAll}
                          disabled={actionableCurrentPageRows.length === 0}
                          sx={{ padding: 0 }}
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell padding="checkbox" />
                  <TableCell />
                  {header("name")}
                  {header("steam_status")}
                  {header("steam_playtime", "right")}
                  {header("vgt_playtime", "right")}
                  {header("vgt_status")}
                  <TableCell align="right">{t("insights.steamSync.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleTrees.map((tree) => {
                  const key = rowKey(tree.row);
                  const isExpanded = expanded.has(key);
                  const hasChildren = tree.children.length > 0;
                  const actionable = isRowActionable(tree.row);
                  return (
                    <Fragment key={key}>
                      <TableRow hover selected={selectedSet.has(key)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSet.has(key)}
                            onClick={(event) => handleRowCheckboxClick(tree.row, event)}
                            onChange={() => {}}
                            disabled={!actionable}
                          />
                        </TableCell>
                        <TableCell padding="checkbox">
                          {hasChildren && (
                            <IconButton
                              size="small"
                              onClick={() => toggleExpanded(key)}
                              aria-label={
                                isExpanded
                                  ? t("insights.steamSync.collapseAddonsLabel")
                                  : t("insights.steamSync.expandAddonsLabel")
                              }
                              sx={{ fontFamily: "monospace", fontWeight: "bold" }}
                            >
                              {isExpanded ? "−" : "+"}
                            </IconButton>
                          )}
                        </TableCell>
                        <TableCell>
                          <Avatar
                            variant="rounded"
                            src={tree.row.entry.gameCoverUrl ?? undefined}
                            sx={{ width: 32, height: 44 }}
                          >
                            {tree.row.entry.steamName.charAt(0)}
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          {tree.row.entry.gameSlug ? (
                            <Link to={`/game/${tree.row.entry.gameSlug}`}>{tree.row.entry.gameName}</Link>
                          ) : (
                            tree.row.entry.steamName
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={
                              tree.row.source === "owned"
                                ? t("insights.steamSync.steamStatusOwned")
                                : t("insights.steamSync.steamStatusWishlisted")
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          {tree.row.source === "owned"
                            ? t("insights.steamSync.hoursValue", {
                                hours: formatHours((tree.row.entry as SteamEntry).steamPlaytimeMinutes),
                              })
                            : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {tree.row.source === "owned" && (tree.row.entry as SteamEntry).vgtPlaytimeMinutes !== null
                            ? t("insights.steamSync.hoursValue", {
                                hours: formatHours((tree.row.entry as SteamEntry).vgtPlaytimeMinutes as number),
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>{renderStatusChip(tree.row)}</TableCell>
                        <TableCell align="right">
                          {renderActions(tree.row, tree.children.length)}
                        </TableCell>
                      </TableRow>
                      {isExpanded &&
                        tree.children.map((child, index) => {
                          const isLast = index === tree.children.length - 1;
                          const childKey = rowKey(child);
                          return (
                            <TableRow key={childKey} hover selected={selectedSet.has(childKey)}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedSet.has(childKey)}
                                  onClick={(event) => handleRowCheckboxClick(child, event)}
                                  onChange={() => {}}
                                  disabled={!isRowActionable(child)}
                                />
                              </TableCell>
                              <TableCell padding="checkbox" />
                              <TableCell>
                                <Avatar
                                  variant="rounded"
                                  src={child.entry.gameCoverUrl ?? undefined}
                                  sx={{ width: 28, height: 38 }}
                                >
                                  {child.entry.steamName.charAt(0)}
                                </Avatar>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", pl: 4.25 }}>
                                  <Typography
                                    component="span"
                                    color="text.disabled"
                                    sx={{ fontFamily: "monospace" }}
                                  >
                                    {isLast ? "└─" : "├─"}
                                  </Typography>
                                  {child.entry.gameSlug ? (
                                    <Link to={`/game/${child.entry.gameSlug}`}>{child.entry.gameName}</Link>
                                  ) : (
                                    child.entry.steamName
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={
                                    child.source === "owned"
                                      ? t("insights.steamSync.steamStatusOwned")
                                      : t("insights.steamSync.steamStatusWishlisted")
                                  }
                                />
                              </TableCell>
                              <TableCell align="right">
                                {child.source === "owned"
                                  ? t("insights.steamSync.hoursValue", {
                                      hours: formatHours((child.entry as SteamEntry).steamPlaytimeMinutes),
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell align="right">
                                {child.source === "owned" && (child.entry as SteamEntry).vgtPlaytimeMinutes !== null
                                  ? t("insights.steamSync.hoursValue", {
                                      hours: formatHours((child.entry as SteamEntry).vgtPlaytimeMinutes as number),
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell>{renderStatusChip(child)}</TableCell>
                              <TableCell align="right">{renderActions(child)}</TableCell>
                            </TableRow>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          component="div"
          count={displayedTrees.length}
          page={currentPage}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget && confirmTarget.length === 1
            ? t("insights.steamSync.confirmSingleTitle", { name: confirmTarget[0].entry.gameName })
            : t("insights.steamSync.confirmBulkTitle", { count: confirmTarget?.length ?? 0 })
        }
        description={confirmDescription}
        confirmLabel={t("insights.steamSync.syncButton")}
        busy={syncEntries.isPending || syncWishlistEntries.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleConfirmSync()}
      />

      <ConfirmDialog
        open={ignoreTarget !== null}
        title={t("insights.steamSync.ignoreConfirmTitle", { count: ignoreTarget?.length ?? 0 })}
        description={t("insights.steamSync.ignoreConfirmDescription")}
        confirmLabel={t("insights.steamSync.ignoreButton")}
        busy={ignoreEntries.isPending || ignoreWishlistEntries.isPending}
        onClose={() => setIgnoreTarget(null)}
        onConfirm={() => void handleConfirmBulkIgnore()}
      />

      <RelinkSteamEntryDialog target={relinkTarget} onClose={() => setRelinkTarget(null)} />

      <ConfirmDialog
        open={unlinkTarget !== null}
        title={
          unlinkTarget
            ? t("insights.steamSync.unlinkConfirmTitle", { name: unlinkTarget.entry.gameName })
            : ""
        }
        description={
          unlinkTarget
            ? t("insights.steamSync.unlinkConfirmDescription", { name: unlinkTarget.entry.gameName })
            : ""
        }
        confirmLabel={t("insights.steamSync.unlinkButton")}
        confirmDisabled={unlinkEntry.isPending || unlinkWishlistEntry.isPending}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={() => void handleConfirmUnlink()}
      />
    </SettingsFrame>
  );
};

export default SteamSyncPage;
