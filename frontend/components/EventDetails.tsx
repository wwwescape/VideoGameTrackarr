import { useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useEvent } from "../hooks/useEvents";
import EventAboutSection from "./EventAboutSection";
import EventActionButtons from "./EventActionButtons";
import EventCoverCard from "./EventCoverCard";
import EventGamesSection from "./EventGamesSection";
import EventNetworksSection from "./EventNetworksSection";
import NotFoundPage from "./NotFoundPage";
import VideoGallery from "./VideoGallery";
import Page, { SECTION_SCROLL_MARGIN_TOP } from "./Page";


const sectionCardSx = {
  borderRadius: 2,
  overflow: "hidden",
  scrollMarginTop: SECTION_SCROLL_MARGIN_TOP,
} as const;

const EventDetails = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const { data: event, isError } = useEvent(identifier);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.eventNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.events") })}
        actionTo="/events"
      />
    );
  }

  if (!event) {
    return <Page>{t("common.loading")}</Page>;
  }

  return (
    <Page>
      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={2}>
            <EventCoverCard event={event} />
            <EventActionButtons eventId={event.id} />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack spacing={3}>
            <Card id="about" sx={sectionCardSx}>
              <EventAboutSection event={event} />
            </Card>
            {event.videos.length > 0 ? (
              <Card id="videos" sx={sectionCardSx}>
                <CardContent>
                  <VideoGallery videos={event.videos} />
                </CardContent>
              </Card>
            ) : null}
            {event.networks.length > 0 ? (
              <Card id="networks" sx={sectionCardSx}>
                <CardContent>
                  <EventNetworksSection networks={event.networks} />
                </CardContent>
              </Card>
            ) : null}
            {event.games.length > 0 ? (
              <Card id="games" sx={sectionCardSx}>
                <CardContent>
                  <EventGamesSection games={event.games} />
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Page>
  );
};

export default EventDetails;
