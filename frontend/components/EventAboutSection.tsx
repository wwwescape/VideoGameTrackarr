import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import Button from "@mui/material/Button";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { EventDetail } from "../api/types";
import { formatEventDateTime, formatEventDateTimeRange } from "../utils/utils";
import ExpandableText from "./ExpandableText";

interface EventAboutSectionProps {
  event: EventDetail;
}

const EventAboutSection = ({ event }: EventAboutSectionProps) => {
  const { t } = useTranslation();
  const dateRange = formatEventDateTimeRange(event.startTime, event.endTime);
  const lastUpdated = formatEventDateTime(event.igdbUpdatedAt);

  return (
    <>
      <CardContent>
        {lastUpdated ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ fontStyle: "italic" }}
          >
            {t("events.about.lastUpdatedLabel", { date: lastUpdated })}
          </Typography>
        ) : null}
        <Typography variant="h4" component="h1" sx={{ lineHeight: 1.15 }}>
          {event.name}
        </Typography>
        {dateRange ? (
          <Typography variant="subtitle1" color="text.secondary">
            {t("events.about.localTimeLabel", { range: dateRange })}
            {event.timeZone ? ` (${event.timeZone})` : ""}
          </Typography>
        ) : null}
        {event.liveStreamUrl ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<OndemandVideoIcon />}
            href={event.liveStreamUrl}
            target="_blank"
            rel="noreferrer"
            sx={{ mt: 1.5 }}
          >
            {t("events.about.liveStreamButton")}
          </Button>
        ) : null}
      </CardContent>
      {event.description ? (
        <>
          <Divider />
          <CardContent>
            <ExpandableText text={event.description} />
          </CardContent>
        </>
      ) : null}
    </>
  );
};

export default EventAboutSection;
