import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import AccessoryList from "./AccessoryList";
import DeviceList from "./DeviceList";
import HardwareSearchBar from "./HardwareSearchBar";
import Page, { STICKY_TOP, ToolbarButton } from "./Page";
import type { HardwareStatusFilter } from "./HardwareListToolbar";
import { useSessionState } from "../hooks/useSessionState";

const HardwarePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState("hardware.searchKeyword", "");
  const [status, setStatus] = useSessionState<HardwareStatusFilter>("hardware.status", "all");

  const debouncedKeyword = useDebouncedValue(searchKeyword.trim(), 500);

  return (
    <Page
      toolbar={
        <>
          <ToolbarButton
            primary
            icon={<AddIcon />}
            label={t("hardware.page.addDeviceButton")}
            onClick={() => navigate("/hardware/device/add")}
          />
          <ToolbarButton
            primary
            icon={<AddIcon />}
            label={t("hardware.page.addAccessoryButton")}
            onClick={() => navigate("/hardware/accessory/add")}
          />
        </>
      }
    >
      <Box
        sx={{
          position: "sticky",
          top: STICKY_TOP,
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
            {t("hardware.page.devicesHeading")}
          </Typography>
          <DeviceList searchKeyword={debouncedKeyword} status={status} />
        </Box>

        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("hardware.page.accessoriesHeading")}
          </Typography>
          <AccessoryList searchKeyword={debouncedKeyword} status={status} />
        </Box>
      </Stack>
    </Page>
  );
};

export default HardwarePage;
