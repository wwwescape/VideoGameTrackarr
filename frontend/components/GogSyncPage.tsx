import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { useQueryClient } from "@tanstack/react-query";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CloudDownloadIcon from "@mui/icons-material/CloudDownloadOutlined";
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
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { resolveImageUrl } from "../api/client";
import {
  getGogStoreDetails,
  type GogEntry,
  type GogIgnoreResult,
  type GogSyncResult,
  type GogWishlistEntry,
} from "../api/integrations";
import {
  useGogEntries,
  useGogStatus,
  useGogWishlistEntries,
  useIgnoreGogEntries,
  useIgnoreGogEntry,
  useIgnoreGogWishlistEntries,
  useIgnoreGogWishlistEntry,
  useSyncGogEntries,
  useSyncGogWishlistEntries,
  useUnignoreGogEntry,
  useUnignoreGogWishlistEntry,
  useUnlinkGogEntry,
  useUnlinkGogWishlistEntry,
} from "../hooks/useIntegrations";
import { useJobsList, useRunJob } from "../hooks/useJobs";
import { useListSort } from "../hooks/useListSort";
import { useSessionState } from "../hooks/useSessionState";
import { sortRows, type SortField } from "../utils/listSort";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import GogDownloadsPanel from "./GogDownloadsPanel";
import GogInstallersDialog from "./GogInstallersDialog";
import { SortHeaderCell } from "./ListControls";
import { ToolbarButton } from "./Page";
import RelinkGogEntryDialog, { type GogRelinkTarget } from "./RelinkGogEntryDialog";
import SettingsFrame from "./SettingsFrame";

const GOG_IMPORT_JOB_ID = "gog_import";

// Owned and wishlist rows share one table, like Steam Sync.
type SyncRow =
  | { source: "owned"; entry: GogEntry }
  | { source: "wishlist"; entry: GogWishlistEntry };
type RowStatus = SyncRow["entry"]["status"];

interface TreeRow {
  row: SyncRow;
  children: SyncRow[];
}

interface SyncTarget {
  row: SyncRow;
  childCount: number;
}

const rowKey = (row: SyncRow) => `${row.source}:${row.entry.gogProductId}`;
const rowName = (row: SyncRow) => row.entry.gameName ?? row.entry.gogName;
const isRowActionable = (row: SyncRow) => row.entry.status === "new";
// What "Hide synced" hides. No catalog match stays visible: it may still need "Add as custom game".
const isRowDone = (row: SyncRow) =>
  row.entry.status === "up_to_date" ||
  row.entry.status === "already_wishlisted" ||
  row.entry.status === "ignored";

const STATUS_CHIP: Record<RowStatus, { color: "default" | "info" | "success"; labelKey: string }> =
  {
    no_match: { color: "default", labelKey: "insights.gogSync.status.noMatch" },
    new: { color: "info", labelKey: "insights.gogSync.status.new" },
    up_to_date: { color: "success", labelKey: "insights.gogSync.status.upToDate" },
    already_wishlisted: { color: "success", labelKey: "insights.gogSync.status.alreadyWishlisted" },
    ignored: { color: "default", labelKey: "insights.gogSync.status.ignored" },
  };

const sourceLabelKey = (row: SyncRow) =>
  row.source === "owned"
    ? "insights.gogSync.gogStatusOwned"
    : "insights.gogSync.gogStatusWishlisted";

type SyncSort = "name" | "gog_status" | "vgt_status";

// Top-level rows plus their DLC/expansion/pack children, nested via parentGameId across both
// sources — an owned base game can have a wishlisted DLC, and the other way round — the same
// grouping as Steam Sync. An entry whose parent isn't listed is its own top-level row.
function buildTrees(owned: GogEntry[], wishlist: GogWishlistEntry[]): TreeRow[] {
  const rows: SyncRow[] = [
    ...owned.map((entry): SyncRow => ({ source: "owned", entry })),
    ...wishlist.map((entry): SyncRow => ({ source: "wishlist", entry })),
  ];
  const gameIds = new Set(
    rows.flatMap((row) => (row.entry.gameId !== null ? [row.entry.gameId] : []))
  );
  const childrenByParent = new Map<number, SyncRow[]>();
  const topLevel: SyncRow[] = [];
  for (const row of rows) {
    const parentGameId = row.entry.parentGameId;
    if (parentGameId !== null && gameIds.has(parentGameId)) {
      childrenByParent.set(parentGameId, [...(childrenByParent.get(parentGameId) ?? []), row]);
    } else {
      topLevel.push(row);
    }
  }
  return topLevel.map((row) => ({
    row,
    children: row.entry.gameId !== null ? (childrenByParent.get(row.entry.gameId) ?? []) : [],
  }));
}

const GogSyncPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: gogStatus } = useGogStatus();
  const { data: ownedEntries } = useGogEntries();
  const { data: wishlistEntries } = useGogWishlistEntries();
  const syncEntries = useSyncGogEntries();
  const syncWishlistEntries = useSyncGogWishlistEntries();
  const ignoreEntry = useIgnoreGogEntry();
  const ignoreWishlistEntry = useIgnoreGogWishlistEntry();
  const ignoreEntries = useIgnoreGogEntries();
  const ignoreWishlistEntries = useIgnoreGogWishlistEntries();
  const unignoreEntry = useUnignoreGogEntry();
  const unignoreWishlistEntry = useUnignoreGogWishlistEntry();
  const unlinkEntry = useUnlinkGogEntry();
  const unlinkWishlistEntry = useUnlinkGogWishlistEntry();
  const { data: jobs } = useJobsList();
  const runJob = useRunJob();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SyncTarget[] | null>(null);
  const [relinkTarget, setRelinkTarget] = useState<GogRelinkTarget | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SyncRow | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<SyncRow[] | null>(null);
  const [installersTarget, setInstallersTarget] = useState<{ gameId: number; name: string } | null>(
    null
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [hideSynced, setHideSynced] = useSessionState("gogSync.hideSynced", false);

  const isImporting = jobs?.find((job) => job.id === GOG_IMPORT_JOB_ID)?.run.status === "running";
  const connected = gogStatus?.connected ?? false;

  // Refresh the table when an Import finishes, so newly matched games show up without a reload.
  const wasImporting = useRef(false);
  useEffect(() => {
    if (wasImporting.current && !isImporting) {
      void queryClient.invalidateQueries({ queryKey: ["gog-entries"] });
      void queryClient.invalidateQueries({ queryKey: ["gog-wishlist-entries"] });
    }
    wasImporting.current = isImporting;
  }, [isImporting, queryClient]);

  const sortFields: SortField<SyncSort>[] = [
    { field: "name", label: t("insights.gogSync.columnName") },
    { field: "gog_status", label: t("insights.gogSync.columnGogStatus") },
    { field: "vgt_status", label: t("insights.gogSync.columnVgtStatus") },
  ];
  const sort = useListSort("gogSync.sortBy", sortFields, { field: "name", direction: "asc" });

  const trees = useMemo(
    () =>
      sortRows(
        buildTrees(ownedEntries ?? [], wishlistEntries ?? []),
        sort.sort,
        {
          name: (tree) => rowName(tree.row),
          gog_status: (tree) => t(sourceLabelKey(tree.row)),
          vgt_status: (tree) => t(STATUS_CHIP[tree.row.entry.status].labelKey),
        },
        (tree) => rowName(tree.row)
      ),
    [ownedEntries, wishlistEntries, sort.sort, t]
  );
  const header = (field: SyncSort) => (
    <SortHeaderCell
      field={field}
      sort={sort.sort}
      onSort={(next) => {
        sort.clickHeader(next);
        setPage(0);
      }}
    >
      {sortFields.find((option) => option.field === field)?.label}
    </SortHeaderCell>
  );

  // With "Hide synced" on, done rows drop out — except a done parent whose DLC still has
  // something to sync, which stays so those children are reachable.
  const displayedTrees = useMemo(() => {
    if (!hideSynced) return trees;
    return trees
      .map((tree) => ({
        row: tree.row,
        children: tree.children.filter((child) => !isRowDone(child)),
      }))
      .filter((tree) => !isRowDone(tree.row) || tree.children.length > 0);
  }, [trees, hideSynced]);

  const lastPage = Math.max(0, Math.ceil(displayedTrees.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleTrees = displayedTrees.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  );

  // Selection works exactly like Steam Sync's: per page with the header checkbox, across
  // pages with "Select all N games", shift-click ranges over what's on screen.
  const allRows = useMemo(() => trees.flatMap((tree) => [tree.row, ...tree.children]), [trees]);
  const allActionableKeys = useMemo(() => allRows.filter(isRowActionable).map(rowKey), [allRows]);
  const selectedRows = allRows.filter(
    (row) => selectedSet.has(rowKey(row)) && isRowActionable(row)
  );
  const allActionableSelected =
    allActionableKeys.length > 0 && selectedRows.length === allActionableKeys.length;

  const currentPageRows = useMemo(
    () => visibleTrees.flatMap((tree) => [tree.row, ...tree.children]),
    [visibleTrees]
  );
  const actionableCurrentPageRows = currentPageRows.filter(isRowActionable);
  const selectedOnCurrentPage = actionableCurrentPageRows.filter((row) =>
    selectedSet.has(rowKey(row))
  );
  const currentPageFullySelected =
    actionableCurrentPageRows.length > 0 &&
    selectedOnCurrentPage.length === actionableCurrentPageRows.length;
  const showSelectAllNotice =
    currentPageFullySelected && allActionableKeys.length > actionableCurrentPageRows.length;
  const showNothingOnPageNotice =
    !allActionableSelected &&
    actionableCurrentPageRows.length === 0 &&
    allActionableKeys.length > 0;

  const visibleOrderedRows = useMemo(() => {
    const list: SyncRow[] = [];
    for (const tree of visibleTrees) {
      list.push(tree.row);
      if (expanded.has(rowKey(tree.row))) list.push(...tree.children);
    }
    return list;
  }, [visibleTrees, expanded]);

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

  const handleRowCheckboxClick = (row: SyncRow, event: React.MouseEvent) => {
    const key = rowKey(row);
    if (event.shiftKey && lastClickedKey) {
      const orderedKeys = visibleOrderedRows.filter(isRowActionable).map(rowKey);
      const anchorIndex = orderedKeys.indexOf(lastClickedKey);
      const targetIndex = orderedKeys.indexOf(key);
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] =
          anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
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
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setLastClickedKey(key);
  };

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

  const idsOf = (rows: SyncRow[], source: SyncRow["source"]) =>
    rows.filter((row) => row.source === source).map((row) => row.entry.gogProductId);

  const handleRunImport = async () => {
    try {
      await runJob.mutateAsync(GOG_IMPORT_JOB_ID);
    } catch (error) {
      console.error("Error running GOG import:", error);
      toast.error(t("insights.gogSync.importErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmSync = async () => {
    if (!confirmTarget) return;
    try {
      const rows = confirmTarget.map((target) => target.row);
      const ownedIds = idsOf(rows, "owned");
      const wishlistIds = idsOf(rows, "wishlist");
      const empty: GogSyncResult = { synced: 0, failed: 0, failures: [] };
      const [ownedResult, wishlistResult] = await Promise.all([
        ownedIds.length > 0 ? syncEntries.mutateAsync(ownedIds) : Promise.resolve(empty),
        wishlistIds.length > 0
          ? syncWishlistEntries.mutateAsync(wishlistIds)
          : Promise.resolve(empty),
      ]);
      const failed = ownedResult.failed + wishlistResult.failed;
      if (failed > 0) {
        toast.error(t("insights.gogSync.syncPartialErrorToast", { failed }), TOAST_OPTIONS);
      } else {
        toast.success(
          t("insights.gogSync.syncSuccessToast", {
            count: ownedResult.synced + wishlistResult.synced,
          }),
          TOAST_OPTIONS
        );
      }
      setSelected([]);
    } catch (error) {
      console.error("Error syncing GOG entries:", error);
      toast.error(t("insights.gogSync.syncErrorToast"), TOAST_OPTIONS);
    } finally {
      setConfirmTarget(null);
    }
  };

  const handleIgnore = async (row: SyncRow) => {
    try {
      if (row.source === "owned") await ignoreEntry.mutateAsync(row.entry.gogProductId);
      else await ignoreWishlistEntry.mutateAsync(row.entry.gogProductId);
    } catch (error) {
      console.error(`Error ignoring GOG product ${row.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  // An entry ignored before IGDB matched it comes back as No catalog match until the next Import.
  const handleUnignore = async (row: SyncRow) => {
    try {
      const updated =
        row.source === "owned"
          ? await unignoreEntry.mutateAsync(row.entry.gogProductId)
          : await unignoreWishlistEntry.mutateAsync(row.entry.gogProductId);
      if (updated.status === "no_match")
        toast.info(t("insights.gogSync.unignoreNoMatchToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error un-ignoring GOG product ${row.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.unignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmBulkIgnore = async () => {
    if (!ignoreTarget) return;
    try {
      const ownedIds = idsOf(ignoreTarget, "owned");
      const wishlistIds = idsOf(ignoreTarget, "wishlist");
      const empty: GogIgnoreResult = { ignored: 0, failed: 0, failures: [] };
      const [ownedResult, wishlistResult] = await Promise.all([
        ownedIds.length > 0 ? ignoreEntries.mutateAsync(ownedIds) : Promise.resolve(empty),
        wishlistIds.length > 0
          ? ignoreWishlistEntries.mutateAsync(wishlistIds)
          : Promise.resolve(empty),
      ]);
      const failed = ownedResult.failed + wishlistResult.failed;
      if (failed > 0) {
        toast.error(t("insights.gogSync.ignorePartialErrorToast", { failed }), TOAST_OPTIONS);
      } else {
        toast.success(
          t("insights.gogSync.ignoreSuccessToast", {
            count: ownedResult.ignored + wishlistResult.ignored,
          }),
          TOAST_OPTIONS
        );
      }
      setSelected([]);
    } catch (error) {
      console.error("Error ignoring GOG entries:", error);
      toast.error(t("insights.gogSync.ignoreBulkErrorToast"), TOAST_OPTIONS);
    } finally {
      setIgnoreTarget(null);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkTarget) return;
    try {
      if (unlinkTarget.source === "owned")
        await unlinkEntry.mutateAsync(unlinkTarget.entry.gogProductId);
      else await unlinkWishlistEntry.mutateAsync(unlinkTarget.entry.gogProductId);
      toast.success(t("insights.gogSync.unlinkSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error unlinking GOG product ${unlinkTarget.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.unlinkErrorToast"), TOAST_OPTIONS);
    } finally {
      setUnlinkTarget(null);
    }
  };

  const handleAddAsCustomGame = async (row: SyncRow) => {
    try {
      const details = await getGogStoreDetails(row.entry.gogProductId);
      navigate("/games/add", {
        state: {
          gogPrefill: {
            gogProductId: row.entry.gogProductId,
            name: details.name,
            coverUrl: details.coverUrl ?? undefined,
            summary: details.summary ?? undefined,
          },
        },
      });
    } catch (error) {
      console.error(
        `Error fetching GOG store details for product ${row.entry.gogProductId}:`,
        error
      );
      toast.error(t("insights.gogSync.storeDetailsErrorToast"), TOAST_OPTIONS);
    }
  };

  const confirmDescription = (() => {
    if (!confirmTarget) return "";
    const addonCount = confirmTarget.reduce((sum, target) => sum + target.childCount, 0);
    const base = (() => {
      if (confirmTarget.length === 1) {
        const { row } = confirmTarget[0];
        return row.source === "owned"
          ? t("insights.gogSync.confirmAddDescription", { name: rowName(row) })
          : t("insights.gogSync.wishlist.confirmAddDescription", { name: rowName(row) });
      }
      const ownedCount = confirmTarget.filter((target) => target.row.source === "owned").length;
      const wishlistCount = confirmTarget.length - ownedCount;
      const parts: string[] = [];
      if (ownedCount > 0)
        parts.push(t("insights.gogSync.confirmBulkOwnedNewPart", { count: ownedCount }));
      if (wishlistCount > 0)
        parts.push(t("insights.gogSync.confirmBulkWishlistNewPart", { count: wishlistCount }));
      return t("insights.gogSync.confirmBulkIntro", { list: parts.join(", ") });
    })();
    if (addonCount === 0) return base;
    return (
      <>
        {base}
        <br />
        {t("insights.gogSync.confirmAddonNote", { count: addonCount })}
      </>
    );
  })();

  const renderActions = (row: SyncRow, childCount = 0) => (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
      {isRowActionable(row) && (
        <Tooltip title={t("insights.gogSync.syncButton")}>
          <IconButton size="small" onClick={() => setConfirmTarget([{ row, childCount }])}>
            <SyncIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.source === "owned" && row.entry.status === "up_to_date" && row.entry.gameId !== null && (
        <Tooltip title={t("insights.gogSync.installersButton")}>
          <IconButton
            size="small"
            onClick={() =>
              row.entry.gameId !== null &&
              setInstallersTarget({ gameId: row.entry.gameId, name: rowName(row) })
            }
          >
            <CloudDownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.entry.status === "no_match" && (
        <Tooltip title={t("insights.gogSync.addCustomButton")}>
          <IconButton size="small" onClick={() => void handleAddAsCustomGame(row)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.entry.gameId !== null && (
        <Tooltip title={t("insights.gogSync.relinkButton")}>
          <IconButton size="small" onClick={() => setRelinkTarget(row)}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.entry.gameId !== null && (
        <Tooltip title={t("insights.gogSync.unlinkButton")}>
          <IconButton size="small" onClick={() => setUnlinkTarget(row)}>
            <LinkOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {row.entry.status === "ignored" ? (
        <Tooltip title={t("insights.gogSync.unignoreButton")}>
          <IconButton size="small" onClick={() => void handleUnignore(row)}>
            <RestoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title={t("insights.gogSync.ignoreButton")}>
          <IconButton size="small" onClick={() => void handleIgnore(row)}>
            <BlockIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const renderRow = (
    row: SyncRow,
    { child, isLast, childCount }: { child: boolean; isLast?: boolean; childCount?: number }
  ) => {
    const key = rowKey(row);
    const isExpanded = expanded.has(key);
    const chip = STATUS_CHIP[row.entry.status];
    return (
      <TableRow key={key} hover selected={selectedSet.has(key)}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={selectedSet.has(key)}
            onClick={(event) => handleRowCheckboxClick(row, event)}
            onChange={() => {}}
            disabled={!isRowActionable(row)}
            slotProps={{ input: { "aria-label": rowName(row) } }}
          />
        </TableCell>
        <TableCell padding="checkbox">
          {!child && (childCount ?? 0) > 0 && (
            <IconButton
              size="small"
              onClick={() => toggleExpanded(key)}
              aria-label={
                isExpanded
                  ? t("insights.gogSync.collapseAddonsLabel")
                  : t("insights.gogSync.expandAddonsLabel")
              }
              sx={{ fontFamily: "monospace", fontWeight: "bold" }}
            >
              {isExpanded ? "−" : "+"}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Avatar
            slotProps={{ img: { loading: "lazy" } }}
            variant="rounded"
            src={resolveImageUrl(row.entry.gameCoverUrl, "t_cover_small") ?? undefined}
            sx={child ? { width: 28, height: 38 } : { width: 32, height: 44 }}
          >
            {row.entry.gogName.charAt(0)}
          </Avatar>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", pl: child ? 4.25 : 0 }}>
            {child && (
              <Typography component="span" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                {isLast ? "└─" : "├─"}
              </Typography>
            )}
            {row.entry.gameSlug ? (
              <Link to={`/game/${row.entry.gameSlug}`}>{row.entry.gameName}</Link>
            ) : (
              row.entry.gogName
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <Chip size="small" variant="outlined" label={t(sourceLabelKey(row))} />
        </TableCell>
        <TableCell>
          <Chip size="small" color={chip.color} label={t(chip.labelKey)} />
        </TableCell>
        <TableCell align="right">{renderActions(row, childCount)}</TableCell>
      </TableRow>
    );
  };

  const emptyMessage = !connected ? (
    <Trans
      i18nKey="insights.gogSync.notConnectedState"
      components={{ 1: <Link to="/settings/integrations" /> }}
    />
  ) : (
    t("insights.gogSync.emptyState")
  );

  return (
    <SettingsFrame
      description={t("insights.gogSync.description")}
      toolbarEnd={
        <ToolbarButton
          primary
          icon={<PlayArrowIcon />}
          label={
            isImporting
              ? t("insights.gogSync.importRunning")
              : t("insights.gogSync.runImportButton")
          }
          onClick={() => void handleRunImport()}
          disabled={isImporting || !connected}
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
              ? t("insights.gogSync.selectedCount", { count: selected.length })
              : t("insights.gogSync.tableHeading")}
          </Typography>
          <Box
            sx={{
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
            {allActionableSelected &&
            allActionableKeys.length > actionableCurrentPageRows.length ? (
              <>
                <Typography variant="body2">
                  {t("insights.gogSync.allSelectedNotice", { count: allActionableKeys.length })}
                </Typography>
                <Button size="small" onClick={() => setSelected([])}>
                  {t("insights.gogSync.clearSelectionButton")}
                </Button>
              </>
            ) : showSelectAllNotice || showNothingOnPageNotice ? (
              <>
                <Typography variant="body2">
                  {showSelectAllNotice
                    ? t("insights.gogSync.pageSelectedNotice", {
                        count: actionableCurrentPageRows.length,
                      })
                    : t("insights.gogSync.nothingOnPageNotice")}
                </Typography>
                <Button size="small" onClick={() => setSelected(allActionableKeys)}>
                  {t("insights.gogSync.selectAllAcrossPagesButton", {
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
                  selectedRows.length === 0 ||
                  ignoreEntries.isPending ||
                  ignoreWishlistEntries.isPending
                }
              >
                {t("insights.gogSync.ignoreSelectedButton")}
              </Button>
              <Button
                startIcon={<SyncIcon />}
                onClick={() =>
                  setConfirmTarget(
                    selectedRows.map((row) => ({ row, childCount: childCountFor(row) }))
                  )
                }
                disabled={
                  selectedRows.length === 0 ||
                  syncEntries.isPending ||
                  syncWishlistEntries.isPending
                }
              >
                {t("insights.gogSync.syncSelectedButton")}
              </Button>
            </Stack>
          ) : (
            <Tooltip title={t("insights.gogSync.hideSyncedTooltip")} describeChild>
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
                label={t("insights.gogSync.hideSyncedLabel")}
                sx={{ flexShrink: 0, mr: 0 }}
              />
            </Tooltip>
          )}
        </Toolbar>

        {trees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>{emptyMessage}</Box>
        ) : displayedTrees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.gogSync.allSyncedState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {/* Same span-wrapped header checkbox as Steam Sync (see the note there). */}
                    <Tooltip title={t("insights.gogSync.selectAllTooltip")}>
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
                  {header("gog_status")}
                  {header("vgt_status")}
                  <TableCell align="right">{t("insights.gogSync.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleTrees.map((tree) => (
                  <Fragment key={rowKey(tree.row)}>
                    {renderRow(tree.row, { child: false, childCount: tree.children.length })}
                    {expanded.has(rowKey(tree.row)) &&
                      tree.children.map((child, index) =>
                        renderRow(child, {
                          child: true,
                          isLast: index === tree.children.length - 1,
                        })
                      )}
                  </Fragment>
                ))}
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
            ? t("insights.gogSync.confirmSingleTitle", { name: rowName(confirmTarget[0].row) })
            : t("insights.gogSync.confirmBulkTitle", { count: confirmTarget?.length ?? 0 })
        }
        description={confirmDescription}
        confirmLabel={t("insights.gogSync.syncButton")}
        busy={syncEntries.isPending || syncWishlistEntries.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleConfirmSync()}
      />

      <ConfirmDialog
        open={ignoreTarget !== null}
        title={t("insights.gogSync.ignoreConfirmTitle", { count: ignoreTarget?.length ?? 0 })}
        description={t("insights.gogSync.ignoreConfirmDescription")}
        confirmLabel={t("insights.gogSync.ignoreButton")}
        busy={ignoreEntries.isPending || ignoreWishlistEntries.isPending}
        onClose={() => setIgnoreTarget(null)}
        onConfirm={() => void handleConfirmBulkIgnore()}
      />

      <GogDownloadsPanel />

      {installersTarget && (
        <GogInstallersDialog
          open
          gameId={installersTarget.gameId}
          gameName={installersTarget.name}
          onClose={() => setInstallersTarget(null)}
        />
      )}

      <RelinkGogEntryDialog target={relinkTarget} onClose={() => setRelinkTarget(null)} />

      <ConfirmDialog
        open={unlinkTarget !== null}
        title={
          unlinkTarget
            ? t("insights.gogSync.unlinkConfirmTitle", { name: unlinkTarget.entry.gameName })
            : ""
        }
        description={
          unlinkTarget
            ? t("insights.gogSync.unlinkConfirmDescription", { name: unlinkTarget.entry.gameName })
            : ""
        }
        confirmLabel={t("insights.gogSync.unlinkButton")}
        confirmDisabled={unlinkEntry.isPending || unlinkWishlistEntry.isPending}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={() => void handleConfirmUnlink()}
      />
    </SettingsFrame>
  );
};

export default GogSyncPage;
