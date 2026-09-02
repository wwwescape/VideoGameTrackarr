import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
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
import type { MediaFormat } from "../api/types";
import { useTrackedSalesItems, useUntrackSalesItem } from "../hooks/useSalesTracking";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import SettingsSubNav from "./SettingsSubNav";

const SaleTrackedPage = () => {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const { data: items } = useTrackedSalesItems();
  const untrackItem = useUntrackSalesItem();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    other: t("games.library.formatOther"),
  };

  const rows = items ?? [];
  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleUntrack = async (libraryItemId: number) => {
    try {
      await untrackItem.mutateAsync(libraryItemId);
      toast.success(t("insights.saleTracked.untrackSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error untracking library item ${libraryItemId}:`, error);
      toast.error(t("insights.saleTracked.untrackErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("insights.saleTracked.heading")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.saleTracked.description")}
        </Typography>
      </Box>

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.saleTracked.emptyState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t("insights.saleTracked.columnName")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnPlatform")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnFormat")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnStorefront")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnTargetPrice")}</TableCell>
                  <TableCell align="right">{t("insights.saleTracked.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.libraryItemId} hover>
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
                    <TableCell>{row.platformName ?? "-"}</TableCell>
                    <TableCell>{row.format ? formatLabels[row.format] : "-"}</TableCell>
                    <TableCell>{row.digitalStorefront ?? "-"}</TableCell>
                    <TableCell>
                      {row.targetPrice != null ? formatCurrency(row.targetPrice, currency) : "-"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("insights.saleTracked.untrackButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleUntrack(row.libraryItemId)}
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
    </>
  );
};

export default SaleTrackedPage;
