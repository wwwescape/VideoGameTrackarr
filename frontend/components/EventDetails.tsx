import { useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EventIcon from "@mui/icons-material/Event";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import { useEvent } from "../hooks/useEvents";
import { useDetailBack } from "../utils/navState";
import { formatEventDateTime, formatEventDateTimeRange } from "../utils/utils";
import { DetailHero, Pill, Section } from "./Detail";
import EventActionButtons from "./EventActionButtons";
import ExpandableText from "./ExpandableText";
import EventGamesSection from "./EventGamesSection";
import EventNetworksSection from "./EventNetworksSection";
import NotFoundPage from "./NotFoundPage";
import VideoGallery from "./VideoGallery";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";



const EventDetails = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const { data: event, isError } = useEvent(identifier);
  const routeCrumbs = useRouteCrumbs();
  const { back, toList } = useDetailBack("/events");

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

  const now = Math.floor(Date.now() / 1000);
  const ongoing = event.startTime !== null && event.startTime <= now;
  const dateRange = formatEventDateTimeRange(event.startTime, event.endTime);
  const lastUpdated = formatEventDateTime(event.igdbUpdatedAt);
  const logo = resolveAssetUrl(event.eventLogoUrl);
  const localTime = dateRange
    ? t("events.about.localTimeLabel", { range: dateRange }) + (event.timeZone ? " (" + event.timeZone + ")" : "")
    : null;

  return (
    <Page
      crumbs={[]}
      toolbar={
        <>
          <ToolbarButton icon={<ArrowBackIcon />} label={toList ? t("nav.events") : t("detail.back")} onClick={back} />
          <ToolbarDivider />
          <EventActionButtons eventId={event.id} />
        </>
      }
      hero={
        <DetailHero
          backdrop={logo ? { url: logo, blur: false } : null}
          media={
            <Box
              sx={{
                aspectRatio: "16 / 9",
                borderRadius: 2.5,
                overflow: "hidden",
                border: 1,
                borderColor: "vgt.borderStrong",
                bgcolor: "vgt.surface2",
                boxShadow: "0 18px 40px rgba(0,0,0,.4)",
                display: "grid",
                placeItems: "center",
                color: "text.secondary",
              }}
            >
              {logo ? (
                <Box component="img" src={logo} alt={event.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <EventIcon fontSize="large" />
              )}
            </Box>
          }
          mediaWidth={{ xs: 150, md: 340 }}
          crumbs={routeCrumbs.slice(0, -1)}
          title={event.name}
          subline={[localTime, lastUpdated ? t("events.about.lastUpdatedLabel", { date: lastUpdated }) : null]}
          pills={
            <>
              <Pill tone={ongoing ? "danger" : "accent"} icon={<ScheduleIcon />}>
                {ongoing ? t("events.page.ongoingHeading") : t("events.page.upcomingHeading")}
              </Pill>
              {event.liveStreamUrl ? (
                <Pill href={event.liveStreamUrl} icon={<OndemandVideoIcon />}>
                  {t("events.about.liveStreamButton")}
                </Pill>
              ) : null}
            </>
          }
        />
      }
    >
      {event.description ? (
        <Section id="about" title={t("games.detail.aboutTitle")}>
          <Box sx={{ color: "text.secondary", maxWidth: 900 }}>
            <ExpandableText text={event.description} />
          </Box>
        </Section>
      ) : null}
      {event.videos.length > 0 ? (
        <Section id="videos" title={t("games.about.videosTitle")}>
          <VideoGallery videos={event.videos} hideTitle />
        </Section>
      ) : null}
      {event.networks.length > 0 ? (
        <Section id="networks" title={t("events.networks.heading")}>
          <EventNetworksSection networks={event.networks} hideTitle />
        </Section>
      ) : null}
      {event.games.length > 0 ? (
        <Section id="games" title={t("events.games.heading")}>
          <EventGamesSection games={event.games} hideTitle />
        </Section>
      ) : null}
    </Page>
  );
};

export default EventDetails;
