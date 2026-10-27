import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import type { EventSummary } from "../api/types";
import { useEvents } from "../hooks/useEvents";
import { useListSort } from "../hooks/useListSort";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { useSessionState } from "../hooks/useSessionState";
import { sortRows, type SortField } from "../utils/listSort";
import { Section } from "./Detail";
import EventCard from "./EventCard";
import { ListSearchField } from "./ListControls";
import {
  FilterChips,
  FilterDialog,
  ListToolbar,
  ToggleFilter,
  type FilterChip,
} from "./ListToolbar";
import Page from "./Page";

type EventSort = "start" | "name";
type EventStatus = "all" | "ongoing" | "upcoming";

// Event cards are landscape, so they start wider than game covers.
const EVENT_CARD_SIZE_DEFAULT = 260;

const EventGrid = ({ events, cardSize }: { events: EventSummary[]; cardSize: number }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        sm: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
      },
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
  const [searchKeyword, setSearchKeyword] = useSessionState("events.searchKeyword", "");
  const sortFields: SortField<EventSort>[] = [
    { field: "start", label: t("events.page.sortStart") },
    { field: "name", label: t("games.listView.columnName") },
  ];
  const sort = useListSort("events.sortBy", sortFields, { field: "start", direction: "asc" });
  const [status, setStatus] = useSessionState<EventStatus>("events.status", "all");
  const [cardSize, setCardSize] = useLocalPreference("events.cardSize", EVENT_CARD_SIZE_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Backend already returns everything with end_time > now, soonest-start-first — split that
  // single list into "already started" vs "not yet started" to mirror IGDB's own Events page,
  // which shows these as two separate sections rather than one flat list.
  const { ongoing, upcoming, shown } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const keyword = searchKeyword.trim().toLowerCase();
    // An event with no start date sorts after the dated ones either way.
    const matching = sortRows(
      (events ?? []).filter((event) => !keyword || event.name.toLowerCase().includes(keyword)),
      sort.sort,
      { start: (event) => event.startTime, name: (event) => event.name },
      (event) => event.name
    );
    const started = matching.filter((event) => event.startTime !== null && event.startTime <= now);
    const notStarted = matching.filter(
      (event) => event.startTime === null || event.startTime > now
    );
    return {
      ongoing: status === "upcoming" ? [] : started,
      upcoming: status === "ongoing" ? [] : notStarted,
      shown:
        (status === "upcoming" ? 0 : started.length) +
        (status === "ongoing" ? 0 : notStarted.length),
    };
  }, [events, searchKeyword, sort.sort, status]);

  const statusLabel: Record<EventStatus, string> = {
    all: t("games.listToolbar.allOption"),
    ongoing: t("events.page.ongoingHeading"),
    upcoming: t("events.page.upcomingHeading"),
  };
  const chips: FilterChip[] =
    status === "all"
      ? []
      : [{ key: "status", label: statusLabel[status], onRemove: () => setStatus("all") }];
  const filtering = status !== "all" || searchKeyword.trim() !== "";

  return (
    <Page
      meta={events ? t("events.page.eventCount", { count: shown }) : undefined}
      toolbarEnd={
        <ListToolbar<string, EventSort>
          cardSize={{ value: cardSize, onChange: setCardSize }}
          sort={sort}
          filter={{ count: chips.length, onOpen: () => setFiltersOpen(true) }}
        />
      }
      actions={
        <ListSearchField
          value={searchKeyword}
          onChange={setSearchKeyword}
          label={t("common.search")}
          placeholder={t("events.page.searchPlaceholder")}
        />
      }
    >
      <FilterChips chips={chips} />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : (
        <>
          {ongoing.length > 0 ? (
            <Section id="ongoing" title={t("events.page.ongoingHeading")}>
              <EventGrid events={ongoing} cardSize={cardSize} />
            </Section>
          ) : null}
          {status !== "ongoing" ? (
            <Section id="upcoming" title={t("events.page.upcomingHeading")}>
              {upcoming.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: "center" }}>
                  {filtering ? t("games.listToolbar.noSearchMatches") : t("events.page.emptyState")}
                </Paper>
              ) : (
                <EventGrid events={upcoming} cardSize={cardSize} />
              )}
            </Section>
          ) : ongoing.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              {t("games.listToolbar.noSearchMatches")}
            </Paper>
          ) : null}
        </>
      )}

      <FilterDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={() => setStatus("all")}
        activeCount={chips.length}
      >
        <ToggleFilter<EventStatus>
          id="events-status"
          label={t("hardware.filter.statusLabel")}
          value={status}
          onChange={setStatus}
          options={(["all", "ongoing", "upcoming"] as EventStatus[]).map((value) => ({
            value,
            label: statusLabel[value],
          }))}
        />
      </FilterDialog>
    </Page>
  );
};

export default EventsPage;
