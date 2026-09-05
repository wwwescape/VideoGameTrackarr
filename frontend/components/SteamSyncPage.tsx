import { Fragment, useMemo, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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
  type SteamEntry,
  type SteamEntryStatus,
  type SteamWishlistEntry,
  type SteamWishlistEntryStatus,
  type SyncResult,
} from "../api/integrations";
import {
  useIgnoreSteamEntry,
  useIgnoreSteamWishlistEntry,
  useSteamEntries,
  useSteamWishlistEntries,
  useSyncSteamEntries,
  useSyncSteamWishlistEntries,
} from "../hooks/useIntegrations";
import { useJobsList, useRunJob } from "../hooks/useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import SettingsSubNav from "./SettingsSubNav";

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
  const { data: jobs } = useJobsList();
  const runJob = useRunJob();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<SyncTarget[] | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const isImporting = jobs?.find((job) => job.id === STEAM_IMPORT_JOB_ID)?.run.status === "running";

  const trees = useMemo(() => {
    const combined = buildTrees(ownedEntries ?? [], wishlistEntries ?? []);
    combined.sort((a, b) => rowName(a.row).localeCompare(rowName(b.row)));
    return combined;
  }, [ownedEntries, wishlistEntries]);

  const actionableTrees = trees.filter((tree) => isRowActionable(tree.row));
  const actionableSelected = trees.filter(
    (tree) => selected.includes(rowKey(tree.row)) && isRowActionable(tree.row)
  );

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

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.length > 0 ? [] : actionableTrees.map((tree) => rowKey(tree.row))));
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

  const visibleTrees = trees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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
        {row.entry.status !== "ignored" && (
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
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("insights.steamSync.heading")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("insights.steamSync.description")}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={() => void handleRunImport()}
          disabled={isImporting}
          sx={{ flexShrink: 0 }}
        >
          {isImporting ? t("insights.steamSync.importRunning") : t("insights.steamSync.runImportButton")}
        </Button>
      </Box>

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        <Toolbar
          sx={{
            pl: 2,
            pr: 1,
            ...(selected.length > 0 && {
              bgcolor: alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
            }),
          }}
        >
          {selected.length > 0 ? (
            <Typography sx={{ flex: "1 1 100%" }} color="inherit" variant="subtitle1">
              {t("insights.steamSync.selectedCount", { count: selected.length })}
            </Typography>
          ) : (
            <Typography sx={{ flex: "1 1 100%" }} variant="h6">
              {t("insights.steamSync.tableHeading")}
            </Typography>
          )}
          {selected.length > 0 && (
            <Button
              startIcon={<SyncIcon />}
              onClick={() =>
                setConfirmTarget(
                  actionableSelected.map((tree) => ({
                    source: tree.row.source,
                    entry: tree.row.entry,
                    childCount: tree.children.length,
                  }))
                )
              }
              disabled={actionableSelected.length === 0}
            >
              {t("insights.steamSync.syncSelectedButton")}
            </Button>
          )}
        </Toolbar>

        {trees.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.steamSync.emptyState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < actionableTrees.length}
                      checked={actionableTrees.length > 0 && selected.length === actionableTrees.length}
                      onChange={toggleSelectAll}
                      disabled={actionableTrees.length === 0}
                    />
                  </TableCell>
                  <TableCell padding="checkbox" />
                  <TableCell />
                  <TableCell>{t("insights.steamSync.columnName")}</TableCell>
                  <TableCell>{t("insights.steamSync.columnSteamStatus")}</TableCell>
                  <TableCell align="right">{t("insights.steamSync.columnSteamPlaytime")}</TableCell>
                  <TableCell align="right">{t("insights.steamSync.columnVgtPlaytime")}</TableCell>
                  <TableCell>{t("insights.steamSync.columnVgtStatus")}</TableCell>
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
                      <TableRow hover selected={selected.includes(key)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selected.includes(key)}
                            onChange={() => toggleRow(key)}
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
                          return (
                            <TableRow key={rowKey(child)} hover>
                              <TableCell padding="checkbox" />
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
          count={trees.length}
          page={page}
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
        confirmDisabled={syncEntries.isPending || syncWishlistEntries.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleConfirmSync()}
      />
    </>
  );
};

export default SteamSyncPage;
