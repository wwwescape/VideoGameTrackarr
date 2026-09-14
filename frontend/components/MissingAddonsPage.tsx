import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import InsightsSubNav from "./InsightsSubNav";
import MissingAddonsSection from "./MissingAddonsSection";

const MissingAddonsPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.missingAddons")}
        </Typography>
      </Box>
      <MissingAddonsSection />
    </>
  );
};

export default MissingAddonsPage;
