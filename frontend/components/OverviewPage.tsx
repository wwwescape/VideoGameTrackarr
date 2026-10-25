import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary, RecentlyAddedHardwareItem } from "../api/types";
import { useDashboardStats, useReleaseCalendar } from "../hooks/useDashboard";
import { useEvents } from "../hooks/useEvents";
import { useGames } from "../hooks/useGames";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useOpenFilteredGames } from "../hooks/useOpenFilteredGames";
import { useAccessoriesWithoutOwnedHardware, useDuplicateLibraryItems, useMissingAddons, useOnSale } from "../hooks/useInsights";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import { Section, Strip } from "./Detail";
import EventsTeaserSection from "./EventsTeaserSection";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";
import OnSaleTeaserSection from "./OnSaleTeaserSection";
import Page from "./Page";
import ReleaseCalendarSection from "./ReleaseCalendarSection";
import { formatPlaytime, StatTile, TileGrid } from "./Stats";

const STRIP_COLUMN = 150;

const SectionLink = ({ children, onClick, to }: { children: ReactNode; onClick?: () => void; to?: string }) => (
  <Box
    {...(to ? { component: Link, to } : { component: ButtonBase, onClick })}
    // `font` first: the shorthand would reset the size after it.
    sx={{ font: "inherit", fontSize: 12.5, fontWeight: 600, color: "primary.main", textDecoration: "none", whiteSpace: "nowrap", px: 0.5 }}
  >
    {children}
  </Box>
);

// The home page (the Dashboard and Overview combined): headline numbers, quick add, what you're
// playing, recent additions and the gaps worth filling in, then the Dashboard's own sections —
// events, sales and the release calendars. Deeper breakdowns live on Insights.
const OverviewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openGames = useOpenFilteredGames();
  const { currency } = useCurrency();
  const { data: stats } = useDashboardStats();
  const { data: hardwareStats } = useHardwareStats();
  const { data: playing } = useGames({ playStatuses: ["playing"] });
  const { data: customGames } = useGames({ sources: ["custom"] });
  const { data: missingAddons } = useMissingAddons();
  const { data: duplicates } = useDuplicateLibraryItems();
  const { data: orphans } = useAccessoriesWithoutOwnedHardware();
  const { data: releases } = useReleaseCalendar();
  const { data: onSaleItems } = useOnSale();
  const { data: events } = useEvents();

  const gameCard = (game: GameSummary) => (
    <GameCard key={game.id} game={game} context="list" contextFunction={() => navigate(`/game/${gameIdentifier(game)}`)} />
  );
  const hardwareCard = (item: RecentlyAddedHardwareItem) => {
    const device = item.device;
    const accessory = item.accessory;
    if (item.kind === "device" && device) {
      return (
        <HardwareCard
          key={`device-${device.id}`}
          name={device.officialName}
          subtitle={[device.manufacturerName, device.hardwarePlatformName].filter(Boolean).join(" · ")}
          imageUrl={device.imageUrl}
          owned={device.owned}
          wishlisted={device.wishlisted}
          ownedQuantity={device.ownedQuantity}
          onClick={() => navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}`)}
        />
      );
    }
    if (item.kind === "accessory" && accessory) {
      return (
        <HardwareCard
          key={`accessory-${accessory.id}`}
          name={accessory.officialName}
          subtitle={[accessory.manufacturerName, accessory.accessoryTypeName].filter(Boolean).join(" · ")}
          imageUrl={accessory.imageUrl}
          owned={accessory.owned}
          wishlisted={accessory.wishlisted}
          ownedQuantity={accessory.ownedQuantity}
          onClick={() => navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`)}
        />
      );
    }
    return null;
  };

  const hardwareOwned = hardwareStats ? hardwareStats.ownedConsoles + hardwareStats.ownedAccessories : undefined;
  const backlog = stats?.playStatusBreakdown.backlog ?? 0;
  const hasGameReleases = (releases ?? []).some((item) => item.kind === "game");
  const hasHardwareReleases = (releases ?? []).some((item) => item.kind !== "game");
  const isEmpty = stats && hardwareStats && stats.totalTracked === 0 && hardwareOwned === 0 && hardwareStats.wishlistHardware === 0;

  const quickAdd = [
    { label: t("nav.addGame"), to: "/games/add" },
    { label: t("nav.addDevice"), to: "/hardware/device/add" },
    { label: t("nav.addAccessory"), to: "/hardware/accessory/add" },
  ];

  const attention = [
    { key: "custom", label: t("overview.attention.custom"), value: customGames?.length, onClick: () => openGames({ sources: ["custom"] }) },
    { key: "missingAddons", label: t("nav.missingAddons"), value: missingAddons?.length, to: "/insights/missing-addons" },
    { key: "duplicates", label: t("overview.attention.duplicates"), value: duplicates?.length, to: "/insights/duplicates" },
    { key: "orphans", label: t("overview.attention.orphans"), value: orphans?.length, to: "/insights/orphaned-accessories" },
  ];

  return (
    <Page>
      {isEmpty ? (
        <Typography variant="h6" component="p" color="text.secondary" sx={{ mb: 1 }}>
          {t("insights.dashboard.welcomeMessage")}
        </Typography>
      ) : null}

      <TileGrid>
        <StatTile
          label={t("overview.tiles.gamesOwned")}
          value={stats?.totalOwned ?? "–"}
          hint={stats ? t("overview.tiles.tracked", { count: stats.totalTracked }) : undefined}
          onClick={() => openGames({ ownershipStatuses: ["owned"] })}
        />
        <StatTile
          label={t("overview.tiles.wishlist")}
          value={stats?.totalWishlisted ?? "–"}
          onClick={() => openGames({ ownershipStatuses: ["wishlisted"] })}
        />
        <StatTile
          label={t("overview.tiles.hardwareOwned")}
          value={hardwareOwned ?? "–"}
          hint={
            hardwareStats
              ? t("overview.tiles.hardwareHint", { devices: hardwareStats.ownedConsoles, accessories: hardwareStats.ownedAccessories })
              : undefined
          }
          to="/hardware"
        />
        <StatTile
          label={t("games.stats.playtimeLoggedLabel")}
          value={stats ? formatPlaytime(stats.totalPlaytimeMinutes, t) : "–"}
          to="/insights"
        />
        <StatTile
          label={t("hardware.stats.collectionValue")}
          value={hardwareStats ? formatCurrency(hardwareStats.collectionValue, currency, { maximumFractionDigits: 0 }) : "–"}
          to="/insights"
        />
      </TileGrid>

      <Section id="quick-add" title={t("overview.quickAdd")}>
        <TileGrid min={200}>
          {quickAdd.map((item) => (
            <ButtonBase
              key={item.to}
              component={Link}
              to={item.to}
              sx={{
                justifyContent: "flex-start",
                gap: 1.25,
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                fontWeight: 600,
                color: "primary.main",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <AddCircleOutlineOutlinedIcon />
              {item.label}
            </ButtonBase>
          ))}
        </TileGrid>
      </Section>

      <Section
        id="now-playing"
        title={t("overview.nowPlaying")}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <SectionLink onClick={() => openGames({ playStatuses: ["backlog"] })}>
              {t("overview.backlogLink", { count: backlog })}
            </SectionLink>
            {playing?.length ? (
              <SectionLink onClick={() => openGames({ playStatuses: ["playing"] })}>{t("common.viewAll")}</SectionLink>
            ) : null}
          </Box>
        }
      >
        {playing?.length ? (
          <Strip columnWidth={STRIP_COLUMN}>{playing.map(gameCard)}</Strip>
        ) : (
          <Typography variant="body2" sx={{ color: "vgt.text3" }}>
            {t("overview.nothingPlaying")}
          </Typography>
        )}
      </Section>

      {stats?.recentlyPlayed.length ? (
        <Section id="recently-played" title={t("overview.recentlyPlayed")}>
          <Strip columnWidth={STRIP_COLUMN}>{stats.recentlyPlayed.map(gameCard)}</Strip>
        </Section>
      ) : null}

      {stats?.recentlyAdded.length ? (
        <Section id="recently-added" title={t("overview.recentlyAddedGames")} action={<SectionLink to="/games">{t("common.viewAll")}</SectionLink>}>
          <Strip columnWidth={STRIP_COLUMN}>{stats.recentlyAdded.map(gameCard)}</Strip>
        </Section>
      ) : null}

      {hardwareStats?.recentlyAdded.length ? (
        <Section
          id="recently-added-hardware"
          title={t("overview.recentlyAddedHardware")}
          action={<SectionLink to="/hardware">{t("common.viewAll")}</SectionLink>}
        >
          <Strip columnWidth={STRIP_COLUMN + 20}>{hardwareStats.recentlyAdded.map(hardwareCard)}</Strip>
        </Section>
      ) : null}

      <Section id="needs-attention" title={t("overview.needsAttention")}>
        <TileGrid>
          {attention.map((tile) => (
            <StatTile
              key={tile.key}
              label={tile.label}
              value={tile.value ?? "–"}
              to={tile.to}
              onClick={tile.onClick}
              quiet={tile.value === 0}
            />
          ))}
        </TileGrid>
      </Section>

      {events?.length ? <EventsTeaserSection /> : null}
      {onSaleItems?.length ? <OnSaleTeaserSection /> : null}
      {hasGameReleases ? <ReleaseCalendarSection scope="games" title={t("insights.dashboard.gamesCalendarHeading")} /> : null}
      {hasHardwareReleases ? (
        <ReleaseCalendarSection scope="hardware" title={t("insights.dashboard.hardwareCalendarHeading")} />
      ) : null}
    </Page>
  );
};

export default OverviewPage;
