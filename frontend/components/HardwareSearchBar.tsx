import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { HardwareStatusFilter } from "./HardwareListToolbar";

const STATUS_OPTIONS: { value: HardwareStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
];

interface HardwareSearchBarProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  status: HardwareStatusFilter;
  onStatusChange: (status: HardwareStatusFilter) => void;
}

// Shown once above the merged Devices/Accessories sections — search and status apply to
// both sections at once, unlike the per-section manufacturer/type/platform/sort controls
// in HardwareListToolbar, which can't merge since Device types and Accessory types are
// different vocabularies.
const HardwareSearchBar = ({
  searchKeyword,
  onSearchKeywordChange,
  status,
  onStatusChange,
}: HardwareSearchBarProps) => (
  <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
    <Stack spacing={1.5}>
      <TextField
        label="Search"
        variant="outlined"
        value={searchKeyword}
        onChange={(event) => onSearchKeywordChange(event.target.value)}
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
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {STATUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            color={status === option.value ? "primary" : "default"}
            variant={status === option.value ? "filled" : "outlined"}
            onClick={() => onStatusChange(option.value)}
          />
        ))}
      </Box>
    </Stack>
  </Paper>
);

export default HardwareSearchBar;
