import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { alpha, useTheme } from "@mui/material/styles";
import BlockIcon from "@mui/icons-material/Block";
import LinkIcon from "@mui/icons-material/Link";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
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
import { toast } from "react-toastify";
import {
  IGDB_LINK_JOB_ID,
  IGDB_MATCH_JOB_ID,
  type IgdbImportEntry,
  type IgdbImportStatus,
} from "../api/igdbImport";
import type { JobSummary } from "../api/types";
import {
  useIgdbImportEntries,
  useInvalidateAfterLinking,
  useJobStatus,
  useLinkIgdbImportEntry,
  useLinkSelectedIgdbImportEntries,
  useSetIgdbImportIgnored,
} from "../hooks/useIgdbImport";
import { useRunJob } from "../hooks/useJobs";
import { useListSort } from "../hooks/useListSort";
import { useSessionState } from "../hooks/useSessionState";
import { gameIdentifier } from "../utils/identifiers";
import { sortRows, type SortField } from "../utils/listSort";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { getReleaseYear } from "../utils/utils";
import ConfirmDialog from "./ConfirmDialog";
import { SortHeaderCell } from "./ListControls";
import LinkToIgdbDialog from "./LinkToIgdbDialog";
import { ToolbarButton } from "./Page";
import SettingsFrame from "./SettingsFrame";

// What Link and Link selected can act on without the user picking a game.
const LINKABLE: IgdbImportStatus[] = ["match_found", "in_library"];

const STATUS_CHIP: Record<IgdbImportStatus, { color: "default" | "info" | "warning" | "success"; labelKey: string }> = {
  match_found: { color: "success", labelKey: "igdbImport.status.matchFound" },
  in_library: { color: "warning", labelKey: "igdbImport.status.inLibrary" },
  several_matches: { color: "info", labelKey: "igdbImport.status.severalMatches" },
  no_match: { color: "default", labelKey: "igdbImport.status.noMatch" },
  not_checked: { color: "default", labelKey: "igdbImport.status.notChecked" },
  ignored: { color: "default", labelKey: "igdbImport.status.ignored" },
};

// The order a status sort reads in: what's ready to link first, ignored last.
const STATUS_ORDER: IgdbImportStatus[] = ["match_found", "in_library", "several_matches", "no_match", "not_checked", "ignored"];

type ImportSort = "name" | "match" | "status";

const isLinkable = (entry: IgdbImportEntry) => LINKABLE.includes(entry.status);

// A custom DLC/expansion/pack opens on the add-on page; every other custom game on the game page.
const ADDON_CATEGORIES = ["dlc_addon", "expansion", "pack"];

// Settings → IGDB Import: every custom game (added by hand) with its IGDB match by name, found
// by the Find matches job. Link them one by one or with Link selected, pick another game with
// Link to IGDB's own dialog, or ignore the ones that aren't on IGDB. Same layout as Steam Sync.
const IgdbImportPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: entries } = useIgdbImportEntries();
  const { data: matchJob } = useJobStatus(IGDB_MATCH_JOB_ID);
  const { data: linkJob } = useJobStatus(IGDB_LINK_JOB_ID);
  const runJob = useRunJob();
  const linkOne = useLinkIgdbImportEntry();
  const linkSelected = useLinkSelectedIgdbImportEntries();
  const setIgnored = useSetIgdbImportIgnored();
  const invalidateAfterLinking = useInvalidateAfterLinking();

  const [hideIgnored, setHideIgnored] = useSessionState("igdbImport.hideIgnored", false);
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [confirmLink, setConfirmLink] = useState<IgdbImportEntry[] | null>(null);
  const [choosing, setChoosing] = useState<IgdbImportEntry | null>(null);
  const [linkFailures, setLinkFailures] = useState<{ gameName: string; error: string }[]>([]);

  const isMatching = matchJob?.run.status === "running";
  const isLinking = linkJob?.run.status === "running";

  // When a job finishes: refresh the list and say how it went.
  useJobFinished(matchJob, (job) => {
    invalidateAfterLinking();
    if (job.run.status === "failed") {
      toast.error(t("igdbImport.matchFailedToast", { error: job.run.error ?? "" }), TOAST_OPTIONS);
    } else {
      toast.success(t("igdbImport.matchDoneToast", { count: Number(job.run.result?.total ?? 0) }), TOAST_OPTIONS);
    }
  });
  useJobFinished(linkJob, (job) => {
    invalidateAfterLinking();
    const result = job.run.result ?? {};
    const failures = (result.failures as { gameName: string; error: string }[] | undefined) ?? [];
    setLinkFailures(failures);
    if (job.run.status === "failed") {
      toast.error(t("igdbImport.linkFailedToast", { error: job.run.error ?? "" }), TOAST_OPTIONS);
    } else {
      toast.success(
        t("igdbImport.linkDoneToast", { count: Number(result.succeeded ?? 0), total: Number(result.total ?? 0) }),
        TOAST_OPTIONS
      );
    }
  });

  const sortFields: SortField<ImportSort>[] = [
    { field: "name", label: t("igdbImport.columnGame") },
    { field: "match", label: t("igdbImport.columnMatch") },
    { field: "status", label: t("igdbImport.columnStatus") },
  ];
  const sort = useListSort("igdbImport.sortBy", sortFields, { field: "name", direction: "asc" });

  const rows = useMemo(
    () =>
      sortRows(
        (entries ?? []).filter((entry) => !hideIgnored || entry.status !== "ignored"),
        sort.sort,
        {
          name: (entry) => entry.gameName,
          match: (entry) => entry.matchName,
          status: (entry) => STATUS_ORDER.indexOf(entry.status),
        },
        (entry) => entry.gameName
      ),
    [entries, hideIgnored, sort.sort]
  );

  const lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleRows = rows.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);

  // Only linkable rows can be selected (a selection can span pages, like Steam Sync's).
  const selectedSet = new Set(selected);
  const allLinkable = rows.filter(isLinkable);
  const selectedRows = allLinkable.filter((entry) => selectedSet.has(entry.gameId));
  const pageLinkable = visibleRows.filter(isLinkable);
  const pageFullySelected = pageLinkable.length > 0 && pageLinkable.every((entry) => selectedSet.has(entry.gameId));
  const allSelected = allLinkable.length > 0 && selectedRows.length === allLinkable.length;

  const toggleOne = (gameId: number) =>
    setSelected((prev) => (prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]));
  const togglePage = () => {
    const pageIds = pageLinkable.map((entry) => entry.gameId);
    setSelected((prev) => (pageFullySelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
  };

  const handleFindMatches = async () => {
    try {
      await runJob.mutateAsync(IGDB_MATCH_JOB_ID);
    } catch (error) {
      console.error("Error starting Find matches:", error);
      toast.error(t("igdbImport.matchStartErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleLinkOne = async (entry: IgdbImportEntry) => {
    try {
      await linkOne.mutateAsync(entry.gameId);
      toast.success(t("igdbImport.linkedOneToast", { name: entry.gameName }), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error linking ${entry.gameName} to IGDB:`, error);
      toast.error(t("igdbImport.linkOneErrorToast", { name: entry.gameName }), TOAST_OPTIONS);
    }
  };

  const handleConfirmLink = async () => {
    if (!confirmLink) return;
    try {
      const count = await linkSelected.mutateAsync(confirmLink.map((entry) => entry.gameId));
      setLinkFailures([]);
      setSelected([]);
      setConfirmLink(null);
      toast.info(t("igdbImport.linkStartedToast", { count }), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error starting Link selected:", error);
      toast.error(t("igdbImport.linkStartErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleIgnore = async (gameIds: number[], ignored: boolean) => {
    try {
      await setIgnored.mutateAsync({ gameIds, ignored });
      setSelected((prev) => prev.filter((id) => !gameIds.includes(id)));
    } catch (error) {
      console.error("Error ignoring IGDB Import entries:", error);
      toast.error(t("igdbImport.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const mergeCount = confirmLink?.filter((entry) => entry.status === "in_library").length ?? 0;
  const progress = (job: JobSummary | undefined) =>
    job?.run.progress ? t("igdbImport.progress", { current: job.run.progress.current, total: job.run.progress.total }) : "";

  const matchCell = (entry: IgdbImportEntry) => {
    if (entry.matchIgdbId === null) {
      return (
        <Typography variant="body2" color="text.secondary">
          {entry.status === "several_matches"
            ? t("igdbImport.severalMatchesHint", { count: entry.exactMatchCount })
            : entry.status === "no_match"
              ? t("igdbImport.noMatchHint")
              : entry.status === "not_checked"
                ? t("igdbImport.notCheckedHint")
                : "—"}
        </Typography>
      );
    }
    const year = getReleaseYear(entry.matchFirstReleaseDate);
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
        <Avatar variant="rounded" src={entry.matchCoverUrl ?? undefined} sx={{ width: 32, height: 44 }}>
          {entry.matchName?.charAt(0)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {entry.matchName}
            {year ? (
              <Box component="span" sx={{ color: "text.secondary" }}>
                {" "}
                ({year})
              </Box>
            ) : null}
          </Typography>
          {entry.status === "in_library" ? (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {t("igdbImport.mergesInto", { name: entry.libraryGameName })}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    );
  };

  return (
    <SettingsFrame
      description={t("igdbImport.description")}
      toolbarEnd={
        <ToolbarButton
          primary
          icon={<SearchIcon />}
          label={isMatching ? t("igdbImport.matchRunning", { progress: progress(matchJob) }) : t("igdbImport.findMatchesButton")}
          onClick={() => void handleFindMatches()}
          disabled={isMatching || isLinking}
        />
      }
    >
      {isLinking ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("igdbImport.linkRunning", { progress: progress(linkJob) })}
          <LinearProgress
            variant={linkJob?.run.progress ? "determinate" : "indeterminate"}
            value={linkJob?.run.progress ? (linkJob.run.progress.current / Math.max(1, linkJob.run.progress.total)) * 100 : 0}
            sx={{ mt: 1 }}
          />
        </Alert>
      ) : null}
      {linkFailures.length ? (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLinkFailures([])}>
          {t("igdbImport.linkFailuresHeading", { count: linkFailures.length })}
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {linkFailures.map((failure) => (
              <li key={failure.gameName}>
                {failure.gameName}: {failure.error}
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        {entries && entries.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>{t("igdbImport.emptyState")}</Box>
        ) : (
          <>
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
              <Typography sx={{ flex: "0 0 auto" }} variant={selectedRows.length > 0 ? "subtitle1" : "h6"}>
                {selectedRows.length > 0
                  ? t("igdbImport.selectedCount", { count: selectedRows.length })
                  : t("igdbImport.tableHeading")}
              </Typography>
              <Box
                sx={{
                  flex: "1 1 auto",
                  order: { xs: 1, sm: 0 },
                  flexBasis: { xs: "100%", sm: "auto" },
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  columnGap: 0.5,
                  px: 1,
                }}
              >
                {allSelected && allLinkable.length > pageLinkable.length ? (
                  <>
                    <Typography variant="body2">{t("igdbImport.allSelectedNotice", { count: allLinkable.length })}</Typography>
                    <Button size="small" onClick={() => setSelected([])}>
                      {t("igdbImport.clearSelectionButton")}
                    </Button>
                  </>
                ) : pageFullySelected && allLinkable.length > pageLinkable.length ? (
                  <>
                    <Typography variant="body2">{t("igdbImport.pageSelectedNotice", { count: pageLinkable.length })}</Typography>
                    <Button size="small" onClick={() => setSelected(allLinkable.map((entry) => entry.gameId))}>
                      {t("igdbImport.selectAllButton", { count: allLinkable.length })}
                    </Button>
                  </>
                ) : null}
              </Box>
              {selectedRows.length > 0 ? (
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    startIcon={<BlockIcon />}
                    onClick={() => void handleIgnore(selectedRows.map((entry) => entry.gameId), true)}
                    disabled={setIgnored.isPending}
                  >
                    {t("igdbImport.ignoreSelectedButton")}
                  </Button>
                  <Button startIcon={<LinkIcon />} onClick={() => setConfirmLink(selectedRows)} disabled={isLinking}>
                    {t("igdbImport.linkSelectedButton")}
                  </Button>
                </Stack>
              ) : (
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideIgnored}
                      onChange={(event) => {
                        setHideIgnored(event.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label={t("igdbImport.hideIgnoredLabel")}
                  sx={{ mr: 0 }}
                />
              )}
            </Toolbar>
            {/* One line per cell, scrolling sideways on a phone like the other tables. */}
            <TableContainer sx={{ "& th, & td": { whiteSpace: "nowrap" } }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={pageFullySelected}
                        indeterminate={!pageFullySelected && pageLinkable.some((entry) => selectedSet.has(entry.gameId))}
                        onChange={togglePage}
                        disabled={pageLinkable.length === 0}
                        slotProps={{ input: { "aria-label": t("igdbImport.selectPageLabel") } }}
                      />
                    </TableCell>
                    <TableCell />
                    {sortFields.map((option) => (
                      <SortHeaderCell
                        key={option.field}
                        field={option.field}
                        sort={sort.sort}
                        onSort={(next) => {
                          sort.clickHeader(next);
                          setPage(0);
                        }}
                      >
                        {option.label}
                      </SortHeaderCell>
                    ))}
                    <TableCell align="right">{t("igdbImport.columnActions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((entry) => {
                    const chip = STATUS_CHIP[entry.status];
                    const year = getReleaseYear(entry.gameFirstReleaseDate);
                    const route = entry.gameCategory && ADDON_CATEGORIES.includes(entry.gameCategory) ? "addon" : "game";
                    return (
                      <TableRow key={entry.gameId} hover selected={selectedSet.has(entry.gameId)} aria-label={entry.gameName}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSet.has(entry.gameId)}
                            onChange={() => toggleOne(entry.gameId)}
                            disabled={!isLinkable(entry)}
                            slotProps={{ input: { "aria-label": t("igdbImport.selectRowLabel", { name: entry.gameName }) } }}
                          />
                        </TableCell>
                        <TableCell>
                          <Avatar variant="rounded" src={entry.gameCoverUrl ?? undefined} sx={{ width: 32, height: 44 }}>
                            {entry.gameName.charAt(0)}
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/${route}/${gameIdentifier({ slug: entry.gameSlug, uuid: entry.gameUuid, name: entry.gameName })}`}
                          >
                            {entry.gameName}
                          </Link>
                          {year ? (
                            <Typography variant="caption" color="text.secondary" component="div">
                              {year}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>{matchCell(entry)}</TableCell>
                        <TableCell>
                          <Chip size="small" color={chip.color} label={t(chip.labelKey)} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {isLinkable(entry) ? (
                            <Button
                              size="small"
                              startIcon={<LinkIcon />}
                              onClick={() => void handleLinkOne(entry)}
                              disabled={linkOne.isPending || isLinking}
                            >
                              {entry.status === "in_library" ? t("igdbImport.mergeButton") : t("igdbImport.linkButton")}
                            </Button>
                          ) : null}
                          {entry.status !== "ignored" ? (
                            <>
                              <Button size="small" onClick={() => setChoosing(entry)} disabled={isLinking}>
                                {t("igdbImport.chooseButton")}
                              </Button>
                              <Tooltip title={t("igdbImport.ignoreButton")}>
                                <IconButton size="small" onClick={() => void handleIgnore([entry.gameId], true)}>
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip title={t("igdbImport.unignoreButton")}>
                              <IconButton size="small" onClick={() => void handleIgnore([entry.gameId], false)}>
                                <RestoreIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={rows.length}
              page={currentPage}
              onPageChange={(_event, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>

      <ConfirmDialog
        open={confirmLink !== null}
        title={t("igdbImport.linkConfirmTitle", { count: confirmLink?.length ?? 0 })}
        description={
          <>
            {t("igdbImport.linkConfirmDescription", { count: confirmLink?.length ?? 0 })}
            {mergeCount ? (
              <Box component="span" sx={{ display: "block", mt: 1 }}>
                {t("igdbImport.linkConfirmMerges", { count: mergeCount })}
              </Box>
            ) : null}
          </>
        }
        confirmLabel={t("igdbImport.linkConfirmLabel")}
        onClose={() => setConfirmLink(null)}
        onConfirm={() => void handleConfirmLink()}
        busy={linkSelected.isPending}
      />
      {choosing ? (
        <LinkToIgdbDialog
          open
          gameId={choosing.gameId}
          gameName={choosing.gameName}
          gameCategory={choosing.gameCategory}
          onLinked={invalidateAfterLinking}
          onClose={() => setChoosing(null)}
        />
      ) : null}
    </SettingsFrame>
  );
};

// Calls `onFinished` once each time `job` goes from running to done (completed or failed).
function useJobFinished(job: JobSummary | undefined, onFinished: (job: JobSummary) => void) {
  const wasRunning = useRef(false);
  const callback = useRef(onFinished);
  callback.current = onFinished;
  useEffect(() => {
    const running = job?.run.status === "running";
    if (wasRunning.current && !running && job) callback.current(job);
    wasRunning.current = running;
  }, [job]);
}

export default IgdbImportPage;
