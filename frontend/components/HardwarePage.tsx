import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import AccessoryList from "./AccessoryList";
import DeviceList from "./DeviceList";
import HardwareSearchBar from "./HardwareSearchBar";
import HardwareSubNav from "./HardwareSubNav";
import type { HardwareStatusFilter } from "./HardwareListToolbar";

const HardwarePage = () => {
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [status, setStatus] = useState<HardwareStatusFilter>("all");

  const debouncedKeyword = useDebouncedValue(searchKeyword.trim(), 500);

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: (theme) => theme.mixins.toolbar.minHeight,
          zIndex: 1,
          bgcolor: "background.default",
          pb: 2.5,
          // Once scrolled content locks under this sticky header, the bottom edge needs to
          // read as an intentional floating panel — otherwise half-covered floating labels
          // (Manufacturer/Device type/etc.) look like clipped/broken text rather than
          // content sitting behind a layer.
          boxShadow: "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <HardwareSubNav />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Hardware
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track owned and wishlisted consoles, handhelds, and accessories.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/hardware/device/add")}>
              Add Device
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/hardware/accessory/add")}>
              Add Accessory
            </Button>
          </Stack>
        </Box>

        <HardwareSearchBar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          status={status}
          onStatusChange={setStatus}
        />
      </Box>

      <Stack
        spacing={3}
        sx={{
          mt: 3,
          // Contains z-index in here to its own stacking context — otherwise MUI's
          // shrunk-label z-index (1, same as the sticky header above) ties with the sticky
          // box's and falls back to DOM order, letting floating labels paint on top of the
          // sticky header instead of staying hidden behind it as the rest of their own
          // component does.
          isolation: "isolate",
        }}
      >
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            Devices
          </Typography>
          <DeviceList searchKeyword={debouncedKeyword} status={status} />
        </Box>

        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            Accessories
          </Typography>
          <AccessoryList searchKeyword={debouncedKeyword} status={status} />
        </Box>
      </Stack>
    </>
  );
};

export default HardwarePage;
