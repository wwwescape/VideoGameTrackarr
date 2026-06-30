import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

export type GameFilter = "all" | "owned" | "wishlist";

const FILTER_OPTIONS: { value: GameFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
];

interface GameListToolbarProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  filter: GameFilter;
  onFilterChange: (filter: GameFilter) => void;
  selectionMode: boolean;
  selectedCount: number;
  visibleCount: number;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onSelectAllVisible: () => void;
  onBulkDelete: () => void;
  onCompare: () => void;
}

// Sticky-feeling toolbar (rendered once, above the virtualized grid) that swaps between
// two rows depending on mode: search + instant filter chips normally, or a contextual
// selection action bar once the user has entered bulk-select mode.
const GameListToolbar = ({
  searchKeyword,
  onSearchKeywordChange,
  filter,
  onFilterChange,
  selectionMode,
  selectedCount,
  visibleCount,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAllVisible,
  onBulkDelete,
  onCompare,
}: GameListToolbarProps) => {
  if (selectionMode) {
    return (
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <IconButton onClick={onExitSelectionMode} aria-label="Exit selection mode">
            <CloseIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            {selectedCount} selected
          </Typography>
          <Tooltip title="Select all">
            <IconButton onClick={onSelectAllVisible} aria-label="Select all visible games" disabled={visibleCount === 0}>
              <DoneAllIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<CompareArrowsIcon />}
            disabled={selectedCount < 2}
            onClick={onCompare}
          >
            Compare
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            disabled={selectedCount === 0}
            onClick={onBulkDelete}
          >
            Remove
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Search games"
            variant="outlined"
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder="Enter game name"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
                endAdornment: searchKeyword && (
                  <InputAdornment position="end" onClick={() => onSearchKeywordChange("")}>
                    <ClearIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
              },
            }}
            fullWidth
          />
          <Tooltip title="Select games">
            <IconButton onClick={onEnterSelectionMode} aria-label="Select games" sx={{ alignSelf: "center" }}>
              <CheckBoxOutlineBlankIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              color={filter === option.value ? "primary" : "default"}
              variant={filter === option.value ? "filled" : "outlined"}
              onClick={() => onFilterChange(option.value)}
            />
          ))}
        </Box>
      </Stack>
    </Paper>
  );
};

export default GameListToolbar;
