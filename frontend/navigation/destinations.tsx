import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CableIcon from "@mui/icons-material/Cable";
import CollectionsIcon from "@mui/icons-material/Collections";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ExtensionOffIcon from "@mui/icons-material/ExtensionOff";
import GamesIcon from "@mui/icons-material/Games";
import InfoIcon from "@mui/icons-material/Info";
import InsightsIcon from "@mui/icons-material/Insights";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MemoryIcon from "@mui/icons-material/Memory";
import RefreshIcon from "@mui/icons-material/Refresh";
import SellIcon from "@mui/icons-material/Sell";
import SettingsIcon from "@mui/icons-material/Settings";
import SteamIcon from "../icons/SteamIcon";

export interface NavSubDestination {
  to: string;
  label: string;
  icon: ReactNode;
  // Renders a divider above this item in the desktop drawer (see NavDrawer.tsx) — for a
  // sub-item that's grouped in the same section but conceptually separate from the rest.
  separatorBefore?: boolean;
}

export interface NavDestination {
  to: string;
  label: string;
  icon: ReactNode;
  // Desktop-drawer-only — see NavDrawer.tsx. Smaller breakpoints rely on each section's
  // own in-page sub-nav (GamesSubNav.tsx/HardwareSubNav.tsx/InsightsSubNav.tsx) instead.
  subItems?: NavSubDestination[];
}

// Single source of truth for the app's top-level destinations — shared by all three
// responsive nav patterns (bottom bar / rail / drawer) so they can never drift apart.
// Takes `t` rather than being a static array so labels stay reactive to language changes;
// call from inside a component with useTranslation()'s t.
export function getNavDestinations(t: TFunction): NavDestination[] {
  return [
    { to: "/", label: t("nav.dashboard"), icon: <DashboardIcon /> },
    {
      to: "/games",
      label: t("nav.games"),
      icon: <GamesIcon />,
      subItems: [
        { to: "/games/add", label: t("nav.addGame"), icon: <AddIcon /> },
        { to: "/games/collections", label: t("nav.collections"), icon: <CollectionsIcon /> },
        { to: "/games/series", label: t("nav.series"), icon: <AccountTreeIcon /> },
      ],
    },
    {
      to: "/hardware",
      label: t("nav.hardware"),
      icon: <MemoryIcon />,
      subItems: [
        { to: "/hardware/device/add", label: t("nav.addDevice"), icon: <AddIcon /> },
        { to: "/hardware/accessory/add", label: t("nav.addAccessory"), icon: <AddIcon /> },
      ],
    },
    {
      to: "/insights",
      label: t("nav.insights"),
      icon: <InsightsIcon />,
      subItems: [
        { to: "/insights/duplicates", label: t("nav.duplicates"), icon: <ContentCopyIcon /> },
        { to: "/insights/missing-dlc", label: t("nav.missingDlc"), icon: <ExtensionOffIcon /> },
        {
          to: "/insights/orphaned-accessories",
          label: t("nav.orphanedAccessories"),
          icon: <LinkOffIcon />,
        },
        { to: "/insights/on-sale", label: t("nav.onSale"), icon: <SellIcon /> },
      ],
    },
    {
      to: "/settings",
      label: t("nav.settings"),
      icon: <SettingsIcon />,
      subItems: [
        { to: "/settings/tags", label: t("nav.tagManager"), icon: <LocalOfferIcon /> },
        { to: "/settings/jobs", label: t("nav.jobs"), icon: <RefreshIcon /> },
        { to: "/settings/integrations", label: t("nav.integrations"), icon: <CableIcon /> },
        {
          to: "/settings/steam-sync",
          label: t("nav.steamSync"),
          icon: <SteamIcon />,
          separatorBefore: true,
        },
      ],
    },
    { to: "/about", label: t("nav.about"), icon: <InfoIcon /> },
  ];
}
