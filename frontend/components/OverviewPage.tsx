import { Fragment, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameSummary, RecentlyAddedHardwareItem } from "../api/types";
import { useDashboardStats, useReleaseCalendar } from "../hooks/useDashboard";
import { useEvents } from "../hooks/useEvents";
import { useGames } from "../hooks/useGames";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useOpenFilteredGames } from "../hooks/useOpenFilteredGames";
import { useOverviewLayout, type OverviewSection, type OverviewSectionKey } from "../hooks/useOverviewLayout";
import { useAccessoriesWithoutOwnedHardware, useDuplicateLibraryItems, useMissingAddons, useOnSale } from "../hooks/useInsights";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import CustomizeOverviewDialog from "./CustomizeOverviewDialog";
import CardCarousel from "./CardCarousel";
import { Section } from "./Detail";
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

// The home page (the Dashboard and Overview combined): headline numbers, quick add, events,
// sales and the release calendars, what you're playing, recent additions and the gaps worth
// filling in. Customize hides and reorders the sections (saved on the account; see
// useOverviewLayout). Deeper breakdowns live on Insights.
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
  const { layout, save: saveLayout } = useOverviewLayout();
  const [customizing, setCustomizing] = useState(false);

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

  const labels: Record<OverviewSectionKey, string> = {
    stats: t("overview.customize.stats"),
    quickAdd: t("overview.quickAdd"),
    events: t("insights.dashboard.eventsHeading"),
    onSale: t("insights.dashboard.onSaleHeading"),
    gamesCalendar: t("insights.dashboard.gamesCalendarHeading"),
    hardwareCalendar: t("insights.dashboard.hardwareCalendarHeading"),
    nowPlaying: t("overview.nowPlaying"),
    recentlyPlayed: t("overview.recentlyPlayed"),
    recentlyAddedGames: t("overview.recentlyAddedGames"),
    recentlyAddedHardware: t("overview.recentlyAddedHardware"),
    needsAttention: t("overview.needsAttention"),
  };

  const attention = [
    { key: "custom", label: t("overview.attention.custom"), value: customGames?.length, onClick: () => openGames({ sources: ["custom"] }) },
    { key: "missingAddons", label: t("nav.missingAddons"), value: missingAddons?.length, to: "/insights/missing-addons" },
    { key: "duplicates", label: t("overview.attention.duplicates"), value: duplicates?.length, to: "/insights/duplicates" },
    { key: "orphans", label: t("overview.attention.orphans"), value: orphans?.length, to: "/insights/orphaned-accessories" },
  ];

  const sections: Record<OverviewSectionKey, ReactNode> = {
    stats: (
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
    ),
    quickAdd: (
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
    ),
    events: events?.length ? <EventsTeaserSection /> : null,
    // Same card widths as the strips below (games, and hardware a little wider).
    onSale: onSaleItems?.length ? <OnSaleTeaserSection columnWidth={STRIP_COLUMN} /> : null,
    gamesCalendar: hasGameReleases ? (
      <ReleaseCalendarSection scope="games" title={labels.gamesCalendar} columnWidth={STRIP_COLUMN} />
    ) : null,
    hardwareCalendar: hasHardwareReleases ? (
      <ReleaseCalendarSection scope="hardware" title={labels.hardwareCalendar} columnWidth={STRIP_COLUMN + 20} />
    ) : null,
    // Every row of cards is a CardCarousel: < and > page through it, with no scrollbar.
    nowPlaying: playing?.length ? (
      <CardCarousel
        id="now-playing"
        title={t("overview.nowPlaying")}
        items={playing}
        getItemKey={(game) => game.id}
        renderItem={gameCard}
        columnWidth={STRIP_COLUMN}
        actions={
          <>
            <SectionLink onClick={() => openGames({ playStatuses: ["backlog"] })}>
              {t("overview.backlogLink", { count: backlog })}
            </SectionLink>
            <SectionLink onClick={() => openGames({ playStatuses: ["playing"] })}>{t("common.viewAll")}</SectionLink>
          </>
        }
      />
    ) : (
      <Section
        id="now-playing"
        title={t("overview.nowPlaying")}
        action={
          <SectionLink onClick={() => openGames({ playStatuses: ["backlog"] })}>
            {t("overview.backlogLink", { count: backlog })}
          </SectionLink>
        }
      >
        <Typography variant="body2" sx={{ color: "vgt.text3" }}>
          {t("overview.nothingPlaying")}
        </Typography>
      </Section>
    ),
    recentlyPlayed: stats?.recentlyPlayed.length ? (
      <CardCarousel
        id="recently-played"
        title={t("overview.recentlyPlayed")}
        items={stats.recentlyPlayed}
        getItemKey={(game) => game.id}
        renderItem={gameCard}
        columnWidth={STRIP_COLUMN}
      />
    ) : null,
    recentlyAddedGames: stats?.recentlyAdded.length ? (
      <CardCarousel
        id="recently-added"
        title={t("overview.recentlyAddedGames")}
        items={stats.recentlyAdded}
        getItemKey={(game) => game.id}
        renderItem={gameCard}
        columnWidth={STRIP_COLUMN}
        viewAllHref="/games"
      />
    ) : null,
    recentlyAddedHardware: hardwareStats?.recentlyAdded.length ? (
      <CardCarousel
        id="recently-added-hardware"
        title={t("overview.recentlyAddedHardware")}
        items={hardwareStats.recentlyAdded}
        getItemKey={(item) => `${item.kind}-${item.device?.id ?? item.accessory?.id}`}
        renderItem={hardwareCard}
        columnWidth={STRIP_COLUMN + 20}
        viewAllHref="/hardware"
      />
    ) : null,
    needsAttention: (
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
    ),
  };

  const handleSaveLayout = async (next: OverviewSection[]) => {
    try {
      await saveLayout.mutateAsync(next);
      setCustomizing(false);
    } catch (error) {
      console.error("Error saving the Overview layout:", error);
      toast.error(t("overview.customize.saveError"), TOAST_OPTIONS);
    }
  };

  const visible = layout.filter((section) => !section.hidden);

  return (
    <Page
      actions={
        <Button size="small" startIcon={<TuneIcon />} onClick={() => setCustomizing(true)}>
          {t("overview.customize.button")}
        </Button>
      }
    >
      {isEmpty ? (
        <Typography variant="h6" component="p" color="text.secondary" sx={{ mb: 1 }}>
          {t("insights.dashboard.welcomeMessage")}
        </Typography>
      ) : null}

      {visible.map((section) => (
        <Fragment key={section.key}>{sections[section.key]}</Fragment>
      ))}
      {visible.length === 0 ? (
        <Typography variant="body2" sx={{ color: "vgt.text3" }}>
          {t("overview.customize.allHidden")}
        </Typography>
      ) : null}

      {customizing ? (
        <CustomizeOverviewDialog
          layout={layout}
          labels={labels}
          saving={saveLayout.isPending}
          onClose={() => setCustomizing(false)}
          onSave={(next) => void handleSaveLayout(next)}
        />
      ) : null}
    </Page>
  );
};

export default OverviewPage;
