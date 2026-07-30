import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import AddDeviceForm from "./AddDeviceForm";
import HardwareSubNav from "./HardwareSubNav";

const AddDevicePage = () => {
  const { t } = useTranslation();

  return (
    <>
      <HardwareSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("hardware.addDevicePage.title")}
        </Typography>
      </Box>
      <AddDeviceForm />
    </>
  );
};

export default AddDevicePage;
