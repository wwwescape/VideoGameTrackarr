import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import DuplicateLibraryItemsSection from "./DuplicateLibraryItemsSection";
import InsightsSubNav from "./InsightsSubNav";

const DuplicatesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.duplicates")}
        </Typography>
      </Box>
      <DuplicateLibraryItemsSection />
    </>
  );
};

export default DuplicatesPage;
