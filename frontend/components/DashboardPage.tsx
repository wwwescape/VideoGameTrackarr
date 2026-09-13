import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { useEvents } from "../hooks/useEvents";
import { useOnSale } from "../hooks/useInsights";
import EventsTeaserSection from "./EventsTeaserSection";
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
  const { data: events, isLoading: eventsLoading } = useEvents();

  if (releasesLoading || onSaleLoading || eventsLoading) {
    return <Typography color="text.secondary">{t("common.loading")}</Typography>;
  }

  const hasGameReleases = (releases ?? []).some((item) => item.kind === "game");
  const hasHardwareReleases = (releases ?? []).some((item) => item.kind !== "game");
  const hasOnSale = Boolean(onSaleItems && onSaleItems.length > 0);
  const hasEvents = Boolean(events && events.length > 0);

  const sections = [
    hasEvents && { key: "events", node: <EventsTeaserSection /> },
    hasOnSale && { key: "onSale", node: <OnSaleTeaserSection /> },
    hasGameReleases && {
      key: "games",
      node: (
        <ReleaseCalendarSection
          scope="games"
          title={t("insights.dashboard.gamesCalendarHeading")}
        />
      ),
    },
    hasHardwareReleases && {
      key: "hardware",
      node: (
        <ReleaseCalendarSection
          scope="hardware"
          title={t("insights.dashboard.hardwareCalendarHeading")}
        />
      ),
    },
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
