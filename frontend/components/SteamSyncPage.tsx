import { useState } from "react";
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
import { getSteamStoreDetails, type SteamEntry, type SteamEntryStatus } from "../api/integrations";
import {
  useIgnoreSteamEntry,
  useSteamEntries,
  useSyncSteamEntries,
} from "../hooks/useIntegrations";
import { useJobsList, useRunJob } from "../hooks/useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import SettingsSubNav from "./SettingsSubNav";

const STEAM_IMPORT_JOB_ID = "steam_import";

const STATUS_CHIP: Record<
  SteamEntryStatus,
  { color: "default" | "info" | "warning" | "success"; labelKey: string }
> = {
  no_match: { color: "default", labelKey: "insights.steamSync.status.noMatch" },
  new: { color: "info", labelKey: "insights.steamSync.status.new" },
  update_available: { color: "warning", labelKey: "insights.steamSync.status.updateAvailable" },
  up_to_date: { color: "success", labelKey: "insights.steamSync.status.upToDate" },
  ignored: { color: "default", labelKey: "insights.steamSync.status.ignored" },
};

const isActionable = (status: SteamEntryStatus) =>
  status === "new" || status === "update_available";
const formatHours = (minutes: number) => (minutes / 60).toFixed(1);

const SteamSyncPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: entries } = useSteamEntries();
  const syncEntries = useSyncSteamEntries();
  const ignoreEntry = useIgnoreSteamEntry();
  const { data: jobs } = useJobsList();
  const runJob = useRunJob();

  const [selected, setSelected] = useState<number[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<SteamEntry[] | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const isImporting = jobs?.find((job) => job.id === STEAM_IMPORT_JOB_ID)?.run.status === "running";
  const rows = entries ?? [];
  const actionableRows = rows.filter((row) => isActionable(row.status));
  const actionableSelected = rows.filter(
    (row) => selected.includes(row.steamAppId) && isActionable(row.status)
  );

  const toggleRow = (steamAppId: number) => {
    setSelected((prev) =>
      prev.includes(steamAppId) ? prev.filter((id) => id !== steamAppId) : [...prev, steamAppId]
    );
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.length > 0 ? [] : actionableRows.map((row) => row.steamAppId)));
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
      const result = await syncEntries.mutateAsync(confirmTarget.map((row) => row.steamAppId));
      if (result.failed > 0) {
        toast.error(
          t("insights.steamSync.syncPartialErrorToast", { failed: result.failed }),
          TOAST_OPTIONS
        );
      } else {
        toast.success(
          t("insights.steamSync.syncSuccessToast", { count: result.synced }),
          TOAST_OPTIONS
        );
      }
      setSelected([]);
    } catch (error) {
      console.error("Error syncing Steam entries:", error);
      toast.error(t("insights.steamSync.syncErrorToast"), TOAST_OPTIONS);
    } finally {
      setConfirmTarget(null);
    }
  };

  const handleIgnore = async (row: SteamEntry) => {
    try {
      await ignoreEntry.mutateAsync(row.steamAppId);
    } catch (error) {
      console.error(`Error ignoring Steam app ${row.steamAppId}:`, error);
      toast.error(t("insights.steamSync.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleAddAsCustomGame = async (row: SteamEntry) => {
    try {
      const details = await getSteamStoreDetails(row.steamAppId);
      navigate("/games/add", {
        state: {
          steamPrefill: {
            steamAppId: row.steamAppId,
            name: details.name,
            coverUrl: details.coverUrl ?? undefined,
            summary: details.summary ?? undefined,
          },
        },
      });
    } catch (error) {
      console.error(`Error fetching Steam store details for app ${row.steamAppId}:`, error);
      toast.error(t("insights.steamSync.storeDetailsErrorToast"), TOAST_OPTIONS);
    }
  };

  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const confirmDescription = (() => {
    if (!confirmTarget) return "";
    if (confirmTarget.length === 1) {
      const [row] = confirmTarget;
      return row.status === "new"
        ? t("insights.steamSync.confirmAddDescription", {
            name: row.gameName,
            hours: formatHours(row.steamPlaytimeMinutes),
          })
        : t("insights.steamSync.confirmUpdateDescription", {
            name: row.gameName,
            currentHours: formatHours(row.vgtPlaytimeMinutes ?? 0),
            newHours: formatHours(row.steamPlaytimeMinutes),
          });
    }
    const newCount = confirmTarget.filter((row) => row.status === "new").length;
    const updateCount = confirmTarget.filter((row) => row.status === "update_available").length;
    return t("insights.steamSync.confirmBulkDescription", { newCount, updateCount });
  })();

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("insights.steamSync.heading")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.steamSync.description")}
        </Typography>
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
              onClick={() => setConfirmTarget(actionableSelected)}
              disabled={actionableSelected.length === 0}
              sx={{ mr: 1 }}
            >
              {t("insights.steamSync.syncSelectedButton")}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={() => void handleRunImport()}
            disabled={isImporting}
          >
            {isImporting
              ? t("insights.steamSync.importRunning")
              : t("insights.steamSync.runImportButton")}
          </Button>
        </Toolbar>

        {rows.length === 0 ? (
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
                      indeterminate={selected.length > 0 && selected.length < actionableRows.length}
                      checked={
                        actionableRows.length > 0 && selected.length === actionableRows.length
                      }
                      onChange={toggleSelectAll}
                      disabled={actionableRows.length === 0}
                    />
                  </TableCell>
                  <TableCell />
                  <TableCell>{t("insights.steamSync.columnName")}</TableCell>
                  <TableCell align="right">{t("insights.steamSync.columnSteamPlaytime")}</TableCell>
                  <TableCell align="right">{t("insights.steamSync.columnVgtPlaytime")}</TableCell>
                  <TableCell>{t("insights.steamSync.columnStatus")}</TableCell>
                  <TableCell align="right">{t("insights.steamSync.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => {
                  const chip = STATUS_CHIP[row.status];
                  const actionable = isActionable(row.status);
                  return (
                    <TableRow
                      key={row.steamAppId}
                      hover
                      selected={selected.includes(row.steamAppId)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.includes(row.steamAppId)}
                          onChange={() => toggleRow(row.steamAppId)}
                          disabled={!actionable}
                        />
                      </TableCell>
                      <TableCell>
                        <Avatar
                          variant="rounded"
                          src={row.gameCoverUrl ?? undefined}
                          sx={{ width: 32, height: 44 }}
                        >
                          {row.steamName.charAt(0)}
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        {row.gameSlug ? (
                          <Link to={`/game/${row.gameSlug}`}>{row.gameName}</Link>
                        ) : (
                          row.steamName
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {t("insights.steamSync.hoursValue", {
                          hours: formatHours(row.steamPlaytimeMinutes),
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {row.vgtPlaytimeMinutes === null
                          ? "—"
                          : t("insights.steamSync.hoursValue", {
                              hours: formatHours(row.vgtPlaytimeMinutes),
                            })}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={chip.color} label={t(chip.labelKey)} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                          {actionable && (
                            <Tooltip title={t("insights.steamSync.syncButton")}>
                              <IconButton size="small" onClick={() => setConfirmTarget([row])}>
                                <SyncIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {row.status === "no_match" && (
                            <Tooltip title={t("insights.steamSync.addCustomButton")}>
                              <IconButton
                                size="small"
                                onClick={() => void handleAddAsCustomGame(row)}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {row.status !== "ignored" && (
                            <Tooltip title={t("insights.steamSync.ignoreButton")}>
                              <IconButton size="small" onClick={() => void handleIgnore(row)}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          component="div"
          count={rows.length}
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
            ? t("insights.steamSync.confirmSingleTitle", { name: confirmTarget[0].gameName })
            : t("insights.steamSync.confirmBulkTitle", { count: confirmTarget?.length ?? 0 })
        }
        description={confirmDescription}
        confirmLabel={t("insights.steamSync.syncButton")}
        confirmDisabled={syncEntries.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void handleConfirmSync()}
      />
    </>
  );
};

export default SteamSyncPage;
