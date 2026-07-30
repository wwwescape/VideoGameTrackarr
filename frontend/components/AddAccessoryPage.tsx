import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import AddAccessoryForm from "./AddAccessoryForm";
import HardwareSubNav from "./HardwareSubNav";

const AddAccessoryPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <HardwareSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("hardware.addAccessoryPage.title")}
        </Typography>
      </Box>
      <AddAccessoryForm />
    </>
  );
};

export default AddAccessoryPage;
