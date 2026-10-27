import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import type { SalesProvider } from "../api/salesTracking";
import {
  useIgnoredSalesTitles,
  useRemoveIgnoredSalesTitle,
  useRetryIgnoredSalesTitle,
} from "../hooks/useSalesTracking";
import { useListSort } from "../hooks/useListSort";
import { gameIdentifier } from "../utils/identifiers";
import { sortRows, type SortField } from "../utils/listSort";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { SortHeaderCell } from "./ListControls";
import SettingsFrame from "./SettingsFrame";

type IgnoredSort = "name" | "provider" | "checked_at";

const PROVIDER_LABEL_KEY: Record<SalesProvider, string> = {
  itad: "insights.salesIgnored.provider.itad",
  platprices: "insights.salesIgnored.provider.platprices",
};

const SalesIgnoredListPage = () => {
  const { t } = useTranslation();
  const { data: items } = useIgnoredSalesTitles();
  const retryTitle = useRetryIgnoredSalesTitle();
  const removeTitle = useRemoveIgnoredSalesTitle();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const sortFields: SortField<IgnoredSort>[] = [
    { field: "name", label: t("insights.salesIgnored.columnName") },
    { field: "provider", label: t("insights.salesIgnored.columnProvider") },
    { field: "checked_at", label: t("insights.salesIgnored.columnCheckedAt"), defaultDirection: "desc" },
  ];
  const sort = useListSort("salesIgnored.sortBy", sortFields, { field: "name", direction: "asc" });
  // Sorted as a whole, then paged; a new sort starts again on the first page.
  const rows = sortRows(
    items ?? [],
    sort.sort,
    {
      name: (row) => row.gameName,
      provider: (row) => t(PROVIDER_LABEL_KEY[row.provider]),
      checked_at: (row) => (row.checkedAt ? Date.parse(row.checkedAt) : null),
    },
    (row) => row.gameName
  );
  const header = (field: IgnoredSort) => (
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
  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleRetry = async (provider: SalesProvider, gameId: number) => {
    try {
      await retryTitle.mutateAsync({ provider, gameId });
      toast.success(t("insights.salesIgnored.retrySuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error retrying ${provider} game ${gameId}:`, error);
      toast.error(t("insights.salesIgnored.retryErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleRemove = async (provider: SalesProvider, gameId: number) => {
    try {
      await removeTitle.mutateAsync({ provider, gameId });
      toast.success(t("insights.salesIgnored.removeSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error removing ${provider} game ${gameId}:`, error);
      toast.error(t("insights.salesIgnored.removeErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <SettingsFrame description={t("insights.salesIgnored.description")}>

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.salesIgnored.emptyState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  {header("name")}
                  {header("provider")}
                  {header("checked_at")}
                  <TableCell align="right">{t("insights.salesIgnored.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={`${row.provider}-${row.gameId}`} hover>
                    <TableCell>
                      <Avatar
                        variant="rounded"
                        src={row.gameCoverUrl ?? undefined}
                        sx={{ width: 32, height: 44 }}
                      >
                        {row.gameName.charAt(0)}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Link to={`/game/${gameIdentifier({ slug: row.gameSlug, uuid: row.gameUuid, name: row.gameName })}`}>
                        {row.gameName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={t(PROVIDER_LABEL_KEY[row.provider])} />
                    </TableCell>
                    <TableCell>
                      {row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("insights.salesIgnored.retryButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleRetry(row.provider, row.gameId)}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("insights.salesIgnored.removeButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleRemove(row.provider, row.gameId)}
                        >
                          <RemoveCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
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
    </SettingsFrame>
  );
};

export default SalesIgnoredListPage;
