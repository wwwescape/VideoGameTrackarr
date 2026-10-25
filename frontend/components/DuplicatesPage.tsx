import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import DuplicateLibraryItemsSection from "./DuplicateLibraryItemsSection";
import Page from "./Page";

// Insights → Duplicates: games with more than one copy of the same kind, each removable.
const DuplicatesPage = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <Typography variant="body2" color="text.secondary">
        {t("insights.duplicates.description")}
      </Typography>
      <DuplicateLibraryItemsSection />
    </Page>
  );
};

export default DuplicatesPage;
