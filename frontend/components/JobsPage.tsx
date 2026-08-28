import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import JobsSection from "./JobsSection";
import SettingsSubNav from "./SettingsSubNav";

const JobsPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.jobs")}
        </Typography>
      </Box>
      <JobsSection />
    </>
  );
};

export default JobsPage;
