import { Fragment, useMemo, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import BlockIcon from "@mui/icons-material/Block";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LinearProgress from "@mui/material/LinearProgress";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import UndoIcon from "@mui/icons-material/Undo";
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
import TableSortLabel from "@mui/material/TableSortLabel";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  type GogEntry,
  type GogEntryStatus,
  type GogIgnoreResult,
  type GogSyncResult,
} from "../api/integrations";
import {
  useGogEntries,
  useIgnoreGogEntries,
  useIgnoreGogEntry,
  useSyncGogEntries,
  useUnignoreGogEntry,
  useUnlinkGogEntry,
} from "../hooks/useIntegrations";
import { useJobsList, useRunJob } from "../hooks/useJobs";
import { useSessionState } from "../hooks/useSessionState";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import RelinkGogEntryDialog, { type RelinkGogTarget } from "./RelinkGogEntryDialog";

const GOG_IMPORT_JOB_ID = "gog_import";

// GOG has no wishlist sync and no playtime, so the page is the owned-only half of the
// Steam Sync page: same review-then-apply shape (import job caches + IGDB-matches,
// the user applies explicitly), same DLC nesting via parentGameId, no playtime columns.
type SyncRow = { entry: GogEntry };

interface TreeRow {
  row: SyncRow;
  children: SyncRow[];
}

interface SyncTarget {
  entry: GogEntry;
  childCount: number;
}

const rowKey = (row: SyncRow) => `gog:${row.entry.gogProductId}`;
const rowName = (row: SyncRow) => row.entry.gameName ?? row.entry.gogName;

const isRowActionable = (row: SyncRow) => row.entry.status === "new";

const isRowDone = (row: SyncRow) =>
  row.entry.status === "up_to_date" || row.entry.status === "ignored";

const STATUS_CHIP: Record<
  GogEntryStatus,
  { color: "default" | "info" | "success"; labelKey: string }
> = {
  no_match: { color: "default", labelKey: "insights.gogSync.status.noMatch" },
  new: { color: "info", labelKey: "insights.gogSync.status.new" },
  up_to_date: { color: "success", labelKey: "insights.gogSync.status.upToDate" },
  ignored: { color: "default", labelKey: "insights.gogSync.status.ignored" },
};

// Groups the entry list into top-level rows + their DLC/expansion/pack children (matched
// via each entry's parentGameId). An entry whose parent isn't present at all (or has no
// parent) is its own top-level row.
function buildTrees(entries: GogEntry[]): TreeRow[] {
  const allRows: SyncRow[] = entries.map((entry) => ({ entry }));

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

const GogSyncPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: entries } = useGogEntries();
  const syncEntries = useSyncGogEntries();
  const ignoreEntry = useIgnoreGogEntry();
  const ignoreEntries = useIgnoreGogEntries();
  const unignoreEntry = useUnignoreGogEntry();
  const unlinkEntry = useUnlinkGogEntry();
  const { data: jobs } = useJobsList();
  const runJob = useRunJob();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SyncTarget[] | null>(null);
  const [relinkTarget, setRelinkTarget] = useState<RelinkGogTarget | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SyncRow | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<SyncRow[] | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [hideSynced, setHideSynced] = useSessionState("gogSync.hideSynced", true);
  const [sortBy, setSortBy] = useSessionState<"name" | "status">("gogSync.sortBy", "name");
  const [sortDirection, setSortDirection] = useSessionState<"asc" | "desc">("gogSync.sortDirection", "asc");

  const importJob = jobs?.find((job) => job.id === GOG_IMPORT_JOB_ID);
  const isImporting = importJob?.run.status === "running";
  // Same shape JobsSection shows for a running job; useJobsList polls every 3s
  // while any job runs, so this bar moves without any extra polling here. Note the
  // backend restarts the count at each import phase (owned upserts, then matching),
  // so the bar can step back at a phase boundary.
  const importProgress = isImporting ? (importJob?.run.progress ?? null) : null;

  const rowSortValue = (row: SyncRow, key: "name" | "status"): string | number => {
    switch (key) {
      case "name":
        return rowName(row).toLowerCase();
      case "status":
        return row.entry.status;
    }
  };

  const handleSort = (column: "name" | "status") => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const trees = useMemo(() => {
    const combined = buildTrees(entries ?? []);
    const dir = sortDirection === "asc" ? 1 : -1;
    const compare = (a: SyncRow, b: SyncRow) => {
      const va = rowSortValue(a, sortBy);
      const vb = rowSortValue(b, sortBy);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    };
    combined.sort((a, b) => compare(a.row, b.row));
    for (const tree of combined) {
      tree.children.sort(compare);
    }
    return combined;
  }, [entries, sortBy, sortDirection]);

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
  const actionableRows = useMemo(() => allRows.filter(isRowActionable), [allRows]);
  const allActionableSelected =
    allActionableKeys.length > 0 && selectedRows.length === allActionableKeys.length;

  const currentPageRows = useMemo(
    () => visibleTrees.flatMap((tree) => [tree.row, ...tree.children]),
    [visibleTrees]
  );
  const actionableCurrentPageRows = currentPageRows.filter(isRowActionable);
  const selectedOnCurrentPage = actionableCurrentPageRows.filter((row) => selectedSet.has(rowKey(row)));
  const currentPageFullySelected =
    actionableCurrentPageRows.length > 0 &&
    selectedOnCurrentPage.length === actionableCurrentPageRows.length;
  const showSelectAllNotice =
    currentPageFullySelected && allActionableKeys.length > actionableCurrentPageRows.length;
  const showNothingOnPageNotice =
    !allActionableSelected && actionableCurrentPageRows.length === 0 && allActionableKeys.length > 0;

  // The currently *visible* (rendered) row order on this page — top-level rows plus any
  // expanded children, in on-screen order — used for shift-click range selection.
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

  const toggleRow = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Gmail-style shift-click: extends the selection from the last-clicked row to this one,
  // over the currently *visible* row order. Falls back to a plain toggle when there's no
  // anchor yet, or the anchor isn't on the current page.
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
      await runJob.mutateAsync(GOG_IMPORT_JOB_ID);
    } catch (error) {
      console.error("Error running GOG import:", error);
      toast.error(t("insights.gogSync.importErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmSync = async () => {
    if (!confirmTarget) return;
    try {
      const result: GogSyncResult = await syncEntries.mutateAsync(
        confirmTarget.map((target) => target.entry.gogProductId)
      );
      if (result.failed > 0) {
        toast.error(t("insights.gogSync.syncPartialErrorToast", { failed: result.failed }), TOAST_OPTIONS);
      } else {
        toast.success(t("insights.gogSync.syncSuccessToast", { count: result.synced }), TOAST_OPTIONS);
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
      await ignoreEntry.mutateAsync(row.entry.gogProductId);
    } catch (error) {
      console.error(`Error ignoring GOG product ${row.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  // An entry ignored before IGDB matched it comes back as No catalog match: the import job
  // skips matching ignored entries, so only the next Import can match it.
  const handleUnignore = async (row: SyncRow) => {
    try {
      const updated = await unignoreEntry.mutateAsync(row.entry.gogProductId);
      if (updated.status === "no_match") {
        toast.info(t("insights.gogSync.unignoreNoMatchToast"), TOAST_OPTIONS);
      }
    } catch (error) {
      console.error(`Error un-ignoring GOG product ${row.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.unignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleConfirmBulkIgnore = async () => {
    if (!ignoreTarget) return;
    try {
      const result: GogIgnoreResult = await ignoreEntries.mutateAsync(
        ignoreTarget.map((row) => row.entry.gogProductId)
      );
      if (result.failed > 0) {
        toast.error(t("insights.gogSync.ignorePartialErrorToast", { failed: result.failed }), TOAST_OPTIONS);
      } else {
        toast.success(t("insights.gogSync.ignoreSuccessToast", { count: result.ignored }), TOAST_OPTIONS);
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
      await unlinkEntry.mutateAsync(unlinkTarget.entry.gogProductId);
      toast.success(t("insights.gogSync.unlinkSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error unlinking GOG product ${unlinkTarget.entry.gogProductId}:`, error);
      toast.error(t("insights.gogSync.unlinkErrorToast"), TOAST_OPTIONS);
    } finally {
      setUnlinkTarget(null);
    }
  };

  const confirmDescription = (() => {
    if (!confirmTarget) return "";
    const addonCount = confirmTarget.reduce((sum, target) => sum + target.childCount, 0);

    const base = (() => {
      if (confirmTarget.length === 1) {
        const [target] = confirmTarget;
        return t("insights.gogSync.confirmAddDescription", {
          name: target.entry.gameName ?? target.entry.gogName,
        });
      }
      return t("insights.gogSync.confirmBulkIntro", { count: confirmTarget.length });
    })();

    const addonNote =
      addonCount > 0 ? t("insights.gogSync.confirmAddonNote", { count: addonCount }) : "";

    return [base, addonNote].filter(Boolean).join(" ");
  })();

  const renderActions = (row: SyncRow) => {
    const ignoreMutation = ignoreEntry;
    const unignoreMutation = unignoreEntry;
    return (
      <Stack direction="row" spacing={0} sx={{ justifyContent: "flex-end" }}>
        {row.entry.gameId !== null && (
          <>
            <Tooltip title={t("insights.gogSync.relinkButton")}>
              <IconButton size="small" onClick={() => setRelinkTarget({ entry: row.entry })}>
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("insights.gogSync.unlinkButton")}>
              <IconButton size="small" onClick={() => setUnlinkTarget(row)}>
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        {row.entry.status !== "ignored" ? (
          <Tooltip title={t("insights.gogSync.ignoreButton")}>
            <IconButton
              size="small"
              onClick={() => void handleIgnore(row)}
              disabled={ignoreMutation.isPending && ignoreMutation.variables === row.entry.gogProductId}
            >
              <BlockIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={t("insights.gogSync.unignoreButton")}>
            <IconButton
              size="small"
              onClick={() => void handleUnignore(row)}
              disabled={unignoreMutation.isPending && unignoreMutation.variables === row.entry.gogProductId}
            >
              <UndoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  };

  const renderStatusChip = (row: SyncRow) => {
    const chip = STATUS_CHIP[row.entry.status];
    return <Chip size="small" color={chip.color} label={t(chip.labelKey)} />;
  };

  return (
    <>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("insights.gogSync.heading")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("insights.gogSync.description")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", flexShrink: 0, minWidth: 180 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={() => void handleRunImport()}
            disabled={isImporting}
          >
            {isImporting ? t("insights.gogSync.importRunning") : t("insights.gogSync.runImportButton")}
          </Button>
          {isImporting && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant={importProgress ? "determinate" : "indeterminate"}
                value={
                  importProgress && importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : undefined
                }
              />
              {importProgress && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {t("insights.gogSync.importProgress", {
                    current: importProgress.current,
                    total: importProgress.total,
                  })}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>

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
            {allActionableSelected && allActionableKeys.length > actionableCurrentPageRows.length ? (
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
                disabled={selectedRows.length === 0 || ignoreEntries.isPending}
              >
                {t("insights.gogSync.ignoreSelectedButton")}
              </Button>
              <Button
                startIcon={<SyncIcon />}
                onClick={() =>
                  setConfirmTarget(
                    selectedRows.map((row) => ({ entry: row.entry, childCount: childCountFor(row) }))
                  )
                }
                disabled={selectedRows.length === 0 || syncEntries.isPending}
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
          <Button
            startIcon={<SyncIcon />}
            onClick={() =>
              setConfirmTarget(
                actionableRows.map((row) => ({ entry: row.entry, childCount: childCountFor(row) }))
              )
            }
            disabled={actionableRows.length === 0 || syncEntries.isPending}
            sx={{ flexShrink: 0 }}
          >
            {t("insights.gogSync.syncAllButton")}
          </Button>
        </Toolbar>

        {trees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.gogSync.emptyState")}
          </Box>
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
                  <TableCell sortDirection={sortBy === "name" ? sortDirection : false}>
                    <TableSortLabel
                      active={sortBy === "name"}
                      direction={sortBy === "name" ? sortDirection : "asc"}
                      onClick={() => handleSort("name")}
                    >
                      {t("insights.gogSync.columnName")}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy === "status" ? sortDirection : false}>
                    <TableSortLabel
                      active={sortBy === "status"}
                      direction={sortBy === "status" ? sortDirection : "asc"}
                      onClick={() => handleSort("status")}
                    >
                      {t("insights.gogSync.columnStatus")}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">{t("insights.gogSync.columnActions")}</TableCell>
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
                            variant="rounded"
                            src={tree.row.entry.gameCoverUrl ?? undefined}
                            sx={{ width: 32, height: 44 }}
                          >
                            {tree.row.entry.gogName.charAt(0)}
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          {tree.row.entry.gameSlug ? (
                            <Link to={`/game/${tree.row.entry.gameSlug}`}>{tree.row.entry.gameName}</Link>
                          ) : (
                            tree.row.entry.gogName
                          )}
                        </TableCell>
                        <TableCell>{renderStatusChip(tree.row)}</TableCell>
                        <TableCell align="right">
                          {renderActions(tree.row)}
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
                                  {child.entry.gogName.charAt(0)}
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
                                    child.entry.gogName
                                  )}
                                </Stack>
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
            ? t("insights.gogSync.confirmSingleTitle", { name: confirmTarget[0].entry.gameName })
            : t("insights.gogSync.confirmBulkTitle", { count: confirmTarget?.length ?? 0 })
        }
        description={confirmDescription}
        confirmLabel={t("insights.gogSync.syncButton")}
        busy={syncEntries.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleConfirmSync()}
      />

      <RelinkGogEntryDialog target={relinkTarget} onClose={() => setRelinkTarget(null)} />

      <ConfirmDialog
        open={ignoreTarget !== null}
        title={t("insights.gogSync.ignoreConfirmTitle", { count: ignoreTarget?.length ?? 0 })}
        description={t("insights.gogSync.ignoreConfirmDescription")}
        confirmLabel={t("insights.gogSync.ignoreButton")}
        busy={ignoreEntries.isPending}
        onClose={() => setIgnoreTarget(null)}
        onConfirm={() => void handleConfirmBulkIgnore()}
      />

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
        confirmDisabled={unlinkEntry.isPending}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={() => void handleConfirmUnlink()}
      />
    </>
  );
};

export default GogSyncPage;
