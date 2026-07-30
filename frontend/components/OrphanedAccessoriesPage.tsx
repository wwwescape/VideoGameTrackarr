import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import AccessoriesWithoutOwnedHardwareSection from "./AccessoriesWithoutOwnedHardwareSection";
import InsightsSubNav from "./InsightsSubNav";

const OrphanedAccessoriesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.orphanedAccessories")}
        </Typography>
      </Box>
      <AccessoriesWithoutOwnedHardwareSection />
    </>
  );
};

export default OrphanedAccessoriesPage;
