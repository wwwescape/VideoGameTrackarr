import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { EventSummary } from "../api/types";
import { useEvents } from "../hooks/useEvents";
import { Section } from "./Detail";
import EventCard from "./EventCard";
import Page from "./Page";

const EventGrid = ({ events }: { events: EventSummary[] }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fill, minmax(260px, 1fr))" },
      gap: "18px 14px",
    }}
  >
    {events.map((event) => (
      <EventCard key={event.id} event={event} />
    ))}
  </Box>
);

const EventsPage = () => {
  const { t } = useTranslation();
  const { data: events, isLoading } = useEvents();

  const now = Math.floor(Date.now() / 1000);
  // Backend already returns everything with end_time > now, soonest-start-first — split that
  // single list into "already started" vs "not yet started" to mirror IGDB's own Events page,
  // which shows these as two separate sections rather than one flat list.
  const ongoing = (events ?? []).filter(
    (event) => event.startTime !== null && event.startTime <= now
  );
  const upcoming = (events ?? []).filter(
    (event) => event.startTime === null || event.startTime > now
  );

  return (
    <Page meta={events ? t("events.page.eventCount", { count: events.length }) : undefined}>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : (
        <>
          {ongoing.length > 0 ? (
            <Section id="ongoing" title={t("events.page.ongoingHeading")}>
              <EventGrid events={ongoing} />
            </Section>
          ) : null}
          <Section id="upcoming" title={t("events.page.upcomingHeading")}>
            {upcoming.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: "center" }}>{t("events.page.emptyState")}</Paper>
            ) : (
              <EventGrid events={upcoming} />
            )}
          </Section>
        </>
      )}
    </Page>
  );
};

export default EventsPage;
