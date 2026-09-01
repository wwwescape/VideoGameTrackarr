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
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import type { SalesProvider } from "../api/salesTracking";
import { useIgnoredSalesTitles, useRetryIgnoredSalesTitle } from "../hooks/useSalesTracking";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import SettingsSubNav from "./SettingsSubNav";

const PROVIDER_LABEL_KEY: Record<SalesProvider, string> = {
  itad: "insights.salesIgnored.provider.itad",
  platprices: "insights.salesIgnored.provider.platprices",
};

const SalesIgnoredListPage = () => {
  const { t } = useTranslation();
  const { data: items } = useIgnoredSalesTitles();
  const retryTitle = useRetryIgnoredSalesTitle();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const rows = items ?? [];
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

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("insights.salesIgnored.heading")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.salesIgnored.description")}
        </Typography>
      </Box>

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
                  <TableCell>{t("insights.salesIgnored.columnName")}</TableCell>
                  <TableCell>{t("insights.salesIgnored.columnProvider")}</TableCell>
                  <TableCell>{t("insights.salesIgnored.columnCheckedAt")}</TableCell>
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
    </>
  );
};

export default SalesIgnoredListPage;
