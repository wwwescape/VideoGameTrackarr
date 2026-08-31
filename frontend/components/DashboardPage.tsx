import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { useOnSale } from "../hooks/useInsights";
import OnSaleTeaserSection from "./OnSaleTeaserSection";
import ReleaseCalendarSection from "./ReleaseCalendarSection";

interface DashboardSection {
  key: string;
  node: ReactNode;
}

const DashboardPage = () => {
  const { t } = useTranslation();
  const { data: releases, isLoading: releasesLoading } = useReleaseCalendar();
  const { data: onSaleItems, isLoading: onSaleLoading } = useOnSale();

  if (releasesLoading || onSaleLoading) {
    return <Typography color="text.secondary">{t("common.loading")}</Typography>;
  }

  const hasGameReleases = (releases ?? []).some((item) => item.kind === "game");
  const hasHardwareReleases = (releases ?? []).some((item) => item.kind !== "game");
  const hasOnSale = Boolean(onSaleItems && onSaleItems.length > 0);

  const sections = [
    hasGameReleases && {
      key: "games",
      node: (
        <>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("insights.dashboard.gamesCalendarHeading")}
          </Typography>
          <ReleaseCalendarSection scope="games" />
        </>
      ),
    },
    hasHardwareReleases && {
      key: "hardware",
      node: (
        <>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("insights.dashboard.hardwareCalendarHeading")}
          </Typography>
          <ReleaseCalendarSection scope="hardware" />
        </>
      ),
    },
    hasOnSale && { key: "onSale", node: <OnSaleTeaserSection /> },
  ].filter(Boolean) as DashboardSection[];

  if (sections.length === 0) {
    return (
      <Typography
        variant="h5"
        component="h2"
        color="text.secondary"
        sx={{ textAlign: "center", mt: 6 }}
      >
        {t("insights.dashboard.welcomeMessage")}
      </Typography>
    );
  }

  return (
    <>
      {sections.map((section, index) => (
        <Box key={section.key}>
          {index > 0 && <Divider sx={{ my: 3 }} />}
          {section.node}
        </Box>
      ))}
    </>
  );
};

export default DashboardPage;
