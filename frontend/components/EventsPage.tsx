import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { EventSummary } from "../api/types";
import { useEvents } from "../hooks/useEvents";
import EventCard from "./EventCard";

const EventGrid = ({ events }: { events: EventSummary[] }) => (
  <Grid container spacing={{ xs: 1.5, sm: 2 }}>
    {events.map((event) => (
      <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
        <EventCard event={event} />
      </Grid>
    ))}
  </Grid>
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
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.events")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("events.page.description")}
        </Typography>
      </Box>
      {isLoading ? (
        <Typography color="text.secondary">{t("common.loading")}</Typography>
      ) : (
        <>
          {ongoing.length > 0 ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                {t("events.page.ongoingHeading")}
              </Typography>
              <EventGrid events={ongoing} />
            </Box>
          ) : null}
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {t("events.page.upcomingHeading")}
            </Typography>
            {upcoming.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("events.page.emptyState")}
              </Typography>
            ) : (
              <EventGrid events={upcoming} />
            )}
          </Box>
        </>
      )}
    </>
  );
};

export default EventsPage;
