import { useTranslation } from "react-i18next";
import { useEvents } from "../hooks/useEvents";
import CardCarousel from "./CardCarousel";
import EventCard from "./EventCard";

// Renders nothing at all (heading included) when there are no upcoming events — same
// "always-empty section is just noise" reasoning as OnSaleTeaserSection.tsx.
// cardSize: columns by card size (see CardCarousel); omitted, by the screen breakpoint.
const EventsTeaserSection = ({ cardSize }: { cardSize?: number }) => {
  const { t } = useTranslation();
  const { data: events } = useEvents();

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <CardCarousel
      items={events}
      getItemKey={(event) => event.id}
      renderItem={(event) => <EventCard event={event} />}
      title={t("insights.dashboard.eventsHeading")}
      viewAllHref="/events"
      cardSize={cardSize}
    />
  );
};

export default EventsTeaserSection;
