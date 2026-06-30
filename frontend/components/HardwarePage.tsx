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

      <Stack spacing={3}>
        <HardwareSearchBar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          status={status}
          onStatusChange={setStatus}
        />

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
