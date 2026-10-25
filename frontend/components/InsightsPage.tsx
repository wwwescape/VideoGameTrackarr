import { useTranslation } from "react-i18next";
import type { PlayStatus } from "../api/types";
import { useDashboardStats } from "../hooks/useDashboard";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useOpenFilteredGames } from "../hooks/useOpenFilteredGames";
import { useAccessoriesWithoutOwnedHardware, useDuplicateLibraryItems, useMissingAddons, useOnSale } from "../hooks/useInsights";
import { usePlatforms } from "../hooks/usePlatforms";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { Section } from "./Detail";
import Page from "./Page";
import { BarList, formatPlaytime, PanelGrid, StatPanel, StatTile, TileGrid, type BarRow } from "./Stats";

const BAR_LIMIT = 10;

// The numbers behind the collection: headline tiles and bar-list breakdowns for games and
// hardware (play status and platform rows open the filtered Games list), then the Insights
// sub-pages with their counts.
const InsightsPage = () => {
  const { t } = useTranslation();
  const openGames = useOpenFilteredGames();
  const { currency } = useCurrency();
  const { data: stats } = useDashboardStats();
  const { data: hardwareStats } = useHardwareStats();
  const { data: platforms } = usePlatforms();
  const { data: missingAddons } = useMissingAddons();
  const { data: duplicates } = useDuplicateLibraryItems();
  const { data: orphans } = useAccessoriesWithoutOwnedHardware();
  const { data: onSale } = useOnSale();

  const playStatusLabels: Record<PlayStatus, string> = {
    none: t("games.stats.playStatusNotStarted"),
    backlog: t("games.stats.playStatusBacklog"),
    playing: t("games.stats.playStatusPlaying"),
    completed: t("games.stats.playStatusCompleted"),
    abandoned: t("games.stats.playStatusAbandoned"),
  };
  const byCount = (a: BarRow, b: BarRow) => b.value - a.value || a.label.localeCompare(b.label);

  const playStatusRows: BarRow[] = Object.entries(stats?.playStatusBreakdown ?? {})
    .map(([status, count]) => ({
      label: playStatusLabels[status as PlayStatus],
      value: count ?? 0,
      onClick: () => openGames({ playStatuses: [status as PlayStatus] }),
    }))
    .sort(byCount);
  const platformRows: BarRow[] = (stats?.platformBreakdown ?? []).map((entry) => {
    const platform = platforms?.find((option) => option.name === entry.name);
    return {
      label: entry.name,
      value: entry.count,
      onClick: platform ? () => openGames({ platformIds: [platform.id] }) : undefined,
    };
  });
  const plainRows = (entries: { name: string; count: number }[] | undefined): BarRow[] =>
    (entries ?? []).map((entry) => ({ label: entry.name, value: entry.count }));

  const bars = (rows: BarRow[]) => (
    <BarList rows={rows} empty={t("insights.page.noData")} limit={BAR_LIMIT} otherLabel={t("insights.page.other")} />
  );

  const subPages = [
    { to: "/insights/missing-addons", label: t("nav.missingAddons"), value: missingAddons?.length },
    { to: "/insights/duplicates", label: t("nav.duplicates"), value: duplicates?.length },
    { to: "/insights/orphaned-accessories", label: t("nav.orphanedAccessories"), value: orphans?.length },
    { to: "/insights/on-sale", label: t("nav.onSale"), value: onSale?.length },
  ];

  return (
    <Page>
      <Section id="games" title={t("insights.page.gamesHeading")}>
        <TileGrid>
          <StatTile label={t("games.stats.ownedLabel")} value={stats?.totalOwned ?? "–"} onClick={() => openGames({ ownershipStatuses: ["owned"] })} />
          <StatTile
            label={t("games.stats.wishlistedLabel")}
            value={stats?.totalWishlisted ?? "–"}
            onClick={() => openGames({ ownershipStatuses: ["wishlisted"] })}
          />
          <StatTile label={t("games.stats.totalTrackedLabel")} value={stats?.totalTracked ?? "–"} />
          <StatTile label={t("games.stats.playtimeLoggedLabel")} value={stats ? formatPlaytime(stats.totalPlaytimeMinutes, t) : "–"} />
          <StatTile
            label={t("games.stats.averageRatingLabel")}
            value={stats ? (stats.averageRating === null ? "–" : stats.averageRating.toFixed(1)) : "–"}
          />
        </TileGrid>
        <PanelGrid>
          <StatPanel title={t("games.stats.byPlayStatusTitle")}>{bars(playStatusRows)}</StatPanel>
          <StatPanel title={t("games.stats.byPlatformTitle")}>{bars(platformRows)}</StatPanel>
          <StatPanel title={t("games.stats.byGenreTitle")}>{bars(plainRows(stats?.genreBreakdown))}</StatPanel>
        </PanelGrid>
      </Section>

      <Section id="hardware" title={t("insights.page.hardwareHeading")}>
        <TileGrid>
          <StatTile label={t("hardware.stats.ownedConsoles")} value={hardwareStats?.ownedConsoles ?? "–"} to="/hardware" />
          <StatTile label={t("hardware.stats.ownedAccessories")} value={hardwareStats?.ownedAccessories ?? "–"} to="/hardware" />
          <StatTile label={t("hardware.stats.wishlistHardware")} value={hardwareStats?.wishlistHardware ?? "–"} to="/hardware" />
          <StatTile
            label={t("hardware.stats.collectionValue")}
            value={hardwareStats ? formatCurrency(hardwareStats.collectionValue, currency, { maximumFractionDigits: 0 }) : "–"}
          />
        </TileGrid>
        <PanelGrid>
          <StatPanel title={t("hardware.stats.byManufacturer")}>{bars(plainRows(hardwareStats?.manufacturerDistribution))}</StatPanel>
          <StatPanel title={t("hardware.stats.byPlatform")}>{bars(plainRows(hardwareStats?.platformDistribution))}</StatPanel>
        </PanelGrid>
      </Section>

      <Section id="more" title={t("insights.page.moreHeading")}>
        <TileGrid>
          {subPages.map((page) => (
            <StatTile key={page.to} label={page.label} value={page.value ?? "–"} to={page.to} quiet={page.value === 0} />
          ))}
        </TileGrid>
      </Section>
    </Page>
  );
};

export default InsightsPage;
