import { useEffect, useMemo, useState, type ReactNode } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { visuallyHidden } from "@mui/utils";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import MoveUpIcon from "@mui/icons-material/MoveUp";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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
import useMediaQuery from "@mui/material/useMediaQuery";

export interface HeadCell {
  id: string;
  numeric: boolean;
  disablePadding: boolean;
  label: string;
  disableHeader: boolean;
}

export interface EnhancedTableRow {
  id: number;
  [key: string]: unknown;
}

type Order = "asc" | "desc";

function descendingComparator<T extends EnhancedTableRow>(a: T, b: T, orderBy: string): number {
  const aValue = a[orderBy] as string | number;
  const bValue = b[orderBy] as string | number;

  if (bValue < aValue) {
    return -1;
  }
  if (bValue > aValue) {
    return 1;
  }
  return 0;
}

function getComparator<T extends EnhancedTableRow>(order: Order, orderBy: string) {
  return order === "desc"
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy);
}

function stableSort<T extends EnhancedTableRow>(array: T[], comparator: (a: T, b: T) => number): T[] {
  const stabilizedThis = array.map((el, index) => [el, index] as const);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

interface EnhancedTableHeadProps {
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  order: Order;
  orderBy: string;
  numSelected: number;
  rowCount: number;
  onRequestSort: (event: React.MouseEvent, property: string) => void;
  headCells: HeadCell[];
}

const EnhancedTableHead = ({
  onSelectAllClick,
  order,
  orderBy,
  numSelected,
  rowCount,
  onRequestSort,
  headCells,
}: EnhancedTableHeadProps) => {
  const createSortHandler = (property: string) => (event: React.MouseEvent) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            slotProps={{ input: { "aria-label": "select all rows" } }}
            disabled={!(rowCount > 0)}
          />
        </TableCell>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.disableHeader ? "center" : headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              <strong>{headCell.disableHeader ? "" : headCell.label}</strong>
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
};

interface EnhancedTableToolbarProps {
  numSelected: number;
  tableName: string;
  tableIcon: ReactNode;
  onAddClick?: (tableName: string) => void;
  onDeleteClick?: (selected: number[], tableName: string) => void;
  selected: number[];
}

const EnhancedTableToolbar = ({
  numSelected,
  tableName,
  tableIcon,
  onAddClick,
  onDeleteClick,
  selected,
}: EnhancedTableToolbarProps) => {
  const handleAddClick = () => {
    onAddClick?.(tableName.toLowerCase());
  };

  const handleDeleteClick = () => {
    onDeleteClick?.(selected, tableName.toLowerCase());
  };

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography sx={{ flex: "1 1 100%" }} color="inherit" variant="subtitle1" component="div">
          {numSelected} selected
        </Typography>
      ) : (
        <>
          {tableIcon}
          <Typography sx={{ flex: "1 1 100%", marginLeft: "20px" }} variant="h6" id="tableTitle" component="div">
            {tableName}
          </Typography>
        </>
      )}

      {numSelected > 0 ? (
        <Tooltip title="Delete">
          <IconButton onClick={handleDeleteClick}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Add">
          <IconButton onClick={handleAddClick}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
    </Toolbar>
  );
};

interface EnhancedTableProps {
  rows: EnhancedTableRow[];
  headCells: HeadCell[];
  tableName: string;
  tableIcon: ReactNode;
  onAddClick?: (tableName: string) => void;
  onDeleteClick?: (selected: number[], tableName: string) => void;
  onMoveClick?: (rowId: number, tableName: string) => void;
  onEditClick?: (rowId: number, tableName: string) => void;
  moveDirection: "up" | "down";
}

const EnhancedTable = ({
  rows,
  headCells,
  tableName,
  tableIcon,
  onAddClick,
  onDeleteClick,
  onMoveClick,
  onEditClick,
  moveDirection,
}: EnhancedTableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState("id");
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    setSelected([]);
  }, [rows]);

  const handleRequestSort = (_event: React.MouseEvent, property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(rows.map((row) => row.id));
      return;
    }
    setSelected([]);
  };

  const handleClick = (_event: React.MouseEvent, id: number) => {
    setSelected((prev) =>
      prev.indexOf(id) === -1 ? [...prev, id] : prev.filter((selectedId) => selectedId !== id)
    );
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMove = (event: React.MouseEvent, rowId: number) => {
    event.stopPropagation();
    onMoveClick?.(rowId, tableName.toLowerCase());
  };

  const handleEdit = (event: React.MouseEvent, rowId: number) => {
    event.stopPropagation();
    onEditClick?.(rowId, tableName.toLowerCase());
  };

  const handleDelete = (event: React.MouseEvent, rowId: number) => {
    event.stopPropagation();
    onDeleteClick?.([rowId], tableName.toLowerCase());
  };

  const isSelected = (id: number) => selected.indexOf(id) !== -1;

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const visibleRows = useMemo(
    () => stableSort(rows, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [order, orderBy, page, rowsPerPage, rows]
  );

  const dataCells = headCells.filter((cell) => !cell.disableHeader);

  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{ width: "100%", mb: 2, overflow: "hidden", borderRadius: 2 }}>
        <EnhancedTableToolbar
          numSelected={selected.length}
          tableName={tableName}
          tableIcon={tableIcon}
          onAddClick={onAddClick}
          onDeleteClick={onDeleteClick}
          selected={selected}
        />
        {isMobile ? (
          <Stack spacing={1.5} sx={{ p: 1.5, pt: 0 }}>
            {visibleRows.length === 0 ? (
              <Box sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>No records</Box>
            ) : (
              visibleRows.map((row) => {
                const isItemSelected = isSelected(row.id);

                return (
                  <Paper
                    key={row.id}
                    variant="outlined"
                    onClick={(event) => handleClick(event, row.id)}
                    sx={{
                      p: 1.5,
                      cursor: "pointer",
                      bgcolor: isItemSelected ? "action.selected" : "inherit",
                    }}
                  >
                    <Stack spacing={1}>
                      {dataCells.map((cell) => (
                        <Box key={cell.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            {cell.label}
                          </Typography>
                          <Typography variant="body2" sx={{ textAlign: "right" }}>
                            {(row[cell.id] as ReactNode) ?? "-"}
                          </Typography>
                        </Box>
                      ))}
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", pt: 0.5 }}>
                        <Tooltip title={moveDirection === "up" ? "Move to collection" : "Move to wishlist"}>
                          <IconButton onClick={(event) => handleMove(event, row.id)}>
                            {moveDirection === "up" ? <MoveUpIcon /> : <MoveDownIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton onClick={(event) => handleEdit(event, row.id)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton onClick={(event) => handleDelete(event, row.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })
            )}
          </Stack>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 720 }} aria-labelledby="tableTitle" size="small">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={rows.length}
                headCells={headCells}
              />
              <TableBody>
                {visibleRows.map((row) => {
                  const isItemSelected = isSelected(row.id);
                  const labelId = `enhanced-table-checkbox-${row.id}`;

                  return (
                    <TableRow
                      hover
                      onClick={(event) => handleClick(event, row.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.id}
                      selected={isItemSelected}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          slotProps={{ input: { "aria-labelledby": labelId } }}
                        />
                      </TableCell>
                      {headCells.map((cell) => (
                        <TableCell
                          key={cell.id}
                          align={cell.disableHeader ? "center" : cell.numeric ? "right" : "left"}
                        >
                          {cell.id === "move" ? (
                            <IconButton onClick={(event) => handleMove(event, row.id)}>
                              {moveDirection === "up" ? (
                                <Tooltip title="Move to collection">
                                  <MoveUpIcon />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Move to wishlist">
                                  <MoveDownIcon />
                                </Tooltip>
                              )}
                            </IconButton>
                          ) : cell.id === "edit" ? (
                            <IconButton onClick={(event) => handleEdit(event, row.id)}>
                              <Tooltip title="Edit">
                                <EditIcon />
                              </Tooltip>
                            </IconButton>
                          ) : cell.id === "delete" ? (
                            <IconButton onClick={(event) => handleDelete(event, row.id)}>
                              <Tooltip title="Delete">
                                <DeleteIcon />
                              </Tooltip>
                            </IconButton>
                          ) : (
                            (row[cell.id] as ReactNode)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {emptyRows > 0 && (
                  <TableRow style={{ height: 33 * emptyRows }}>
                    <TableCell colSpan={headCells.length + 1} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default EnhancedTable;
