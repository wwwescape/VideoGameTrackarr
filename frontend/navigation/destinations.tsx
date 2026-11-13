import type { ReactNode } from "react";
import type { LabId } from "../api/labs";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import BlockIcon from "@mui/icons-material/Block";
import CableIcon from "@mui/icons-material/Cable";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import EventIcon from "@mui/icons-material/Event";
import ExtensionOffIcon from "@mui/icons-material/ExtensionOff";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import InsightsIcon from "@mui/icons-material/Insights";
import LabelIcon from "@mui/icons-material/LabelOutlined";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import MemoryIcon from "@mui/icons-material/Memory";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScienceIcon from "@mui/icons-material/ScienceOutlined";
import SellIcon from "@mui/icons-material/SellOutlined";
import ShelvesIcon from "@mui/icons-material/Shelves";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import ToysIcon from "@mui/icons-material/ToysOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import ViewWeekIcon from "@mui/icons-material/ViewWeekOutlined";
import SlideshowIcon from "@mui/icons-material/SlideshowOutlined";
import GamesIcon from "@mui/icons-material/Games";
import IgdbIcon from "../icons/IgdbIcon";
import LegoDimensionsIcon from "../icons/LegoDimensionsIcon";
import SteamIcon from "../icons/SteamIcon";

export interface NavSubDestination {
  to: string;
  // A key in locales/*/translation.json — translated where the nav renders.
  labelKey: string;
  icon: ReactNode;
  // Draws a divider above this item — for a sub-page that's grouped in the same section but
  // conceptually separate from the rest (Steam Sync and the sale lists under Settings).
  separatorBefore?: boolean;
  // Only shown while this Settings → Labs feature is on.
  lab?: LabId;
}

export interface NavDestination {
  to: string;
  labelKey: string;
  icon: ReactNode;
  // Shown under the destination while you're inside it, e.g. Games → Add Game.
  subItems?: NavSubDestination[];
  // Other path prefixes that belong to this section although they aren't under `to`: a
  // game's page lives at /game/:id, not /games/….
  alsoActiveFor?: string[];
  // Which count the sidebar shows beside it.
  count?: "games" | "hardware";
}

export interface NavGroup {
  labelKey: string;
  items: NavDestination[];
}

// Single source of truth for the sidebar (permanent on desktop, a drawer on phones).
export const navGroups: NavGroup[] = [
  {
    labelKey: "nav.groups.library",
    items: [
      { to: "/", labelKey: "nav.overview", icon: <DashboardIcon /> },
      { to: "/events", labelKey: "nav.events", icon: <EventIcon /> },
      {
        to: "/games",
        labelKey: "nav.games",
        icon: <GamesIcon />,
        count: "games",
        alsoActiveFor: ["/game", "/addon", "/compare"],
        subItems: [
          { to: "/games/add", labelKey: "nav.addGame", icon: <AddCircleOutlineIcon /> },
          {
            to: "/games/shelf",
            labelKey: "nav.gameShelf",
            icon: <ShelvesIcon />,
            lab: "game_shelf",
          },
          {
            to: "/games/collections",
            labelKey: "nav.collections",
            icon: <CollectionsBookmarkIcon />,
          },
          { to: "/games/series", labelKey: "nav.series", icon: <AccountTreeIcon /> },
          { to: "/games/platforms", labelKey: "nav.platforms", icon: <VideogameAssetIcon /> },
        ],
      },
      {
        to: "/toys-to-life",
        labelKey: "nav.toysToLife",
        icon: <ToysIcon />,
        subItems: [
          {
            to: "/toys-to-life/lego-dimensions",
            labelKey: "nav.legoDimensions",
            icon: <LegoDimensionsIcon />,
          },
        ],
      },
      {
        to: "/hardware",
        labelKey: "nav.hardware",
        icon: <MemoryIcon />,
        count: "hardware",
        subItems: [
          { to: "/hardware/device/add", labelKey: "nav.addDevice", icon: <AddCircleOutlineIcon /> },
          {
            to: "/hardware/accessory/add",
            labelKey: "nav.addAccessory",
            icon: <AddCircleOutlineIcon />,
          },
        ],
      },
    ],
  },
  {
    labelKey: "nav.groups.insights",
    items: [
      {
        to: "/insights",
        labelKey: "nav.insights",
        icon: <InsightsIcon />,
        subItems: [
          { to: "/insights/duplicates", labelKey: "nav.duplicates", icon: <ContentCopyIcon /> },
          {
            to: "/insights/missing-addons",
            labelKey: "nav.missingAddons",
            icon: <ExtensionOffIcon />,
          },
          {
            to: "/insights/orphaned-accessories",
            labelKey: "nav.orphanedAccessories",
            icon: <LinkOffIcon />,
          },
          { to: "/insights/on-sale", labelKey: "nav.onSale", icon: <SellIcon /> },
        ],
      },
    ],
  },
  {
    labelKey: "nav.groups.system",
    items: [
      {
        to: "/settings",
        labelKey: "nav.settings",
        icon: <SettingsIcon />,
        subItems: settingsPages(),
      },
      { to: "/about", labelKey: "nav.about", icon: <InfoIcon /> },
    ],
  },
];

// Settings' sub-pages, shared by the sidebar and the toolbar tabs on every Settings page.
// "General" (the Settings page itself) leads the tabs but isn't repeated in the sidebar,
// where Settings is that link.
export function settingsPages(): NavSubDestination[] {
  return [
    { to: "/settings/tags", labelKey: "nav.tagManager", icon: <LabelIcon /> },
    { to: "/settings/labs", labelKey: "nav.labs", icon: <ScienceIcon /> },
    { to: "/settings/jobs", labelKey: "nav.jobs", icon: <RefreshIcon /> },
    { to: "/settings/integrations", labelKey: "nav.integrations", icon: <CableIcon /> },
    { to: "/settings/emulation", labelKey: "nav.emulation", icon: <SportsEsportsIcon /> },
    {
      to: "/settings/game-cases",
      labelKey: "nav.gameCases",
      icon: <ViewWeekIcon />,
      lab: "game_shelf",
    },
    {
      to: "/settings/screensaver",
      labelKey: "nav.screensaver",
      icon: <SlideshowIcon />,
      lab: "screensaver",
    },
    {
      to: "/settings/igdb-import",
      labelKey: "nav.igdbImport",
      icon: <IgdbIcon />,
      separatorBefore: true,
    },
    { to: "/settings/steam-sync", labelKey: "nav.steamSync", icon: <SteamIcon /> },
    { to: "/settings/gog-sync", labelKey: "nav.gogSync", icon: <DownloadIcon /> },
    { to: "/settings/sale-tracked", labelKey: "nav.saleTracked", icon: <VisibilityIcon /> },
    { to: "/settings/sales-ignored", labelKey: "nav.salesIgnored", icon: <BlockIcon /> },
  ];
}

export const settingsGeneralPage: NavSubDestination = {
  to: "/settings",
  labelKey: "nav.settingsGeneral",
  icon: <TuneIcon />,
};

export const navDestinations: NavDestination[] = navGroups.flatMap((group) => group.items);

// Prefix match, so a page nested under a destination (an edit page, an add flow) still
// highlights it. "/" is exact, or it would match everything.
export function isPathWithin(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function isInSection(pathname: string, destination: NavDestination): boolean {
  return [destination.to, ...(destination.alsoActiveFor ?? [])].some((prefix) =>
    isPathWithin(pathname, prefix)
  );
}

// A sub-page's lab is on (or it has none): the sidebar and the Settings tabs skip the rest.
export function isSubDestinationEnabled(
  sub: NavSubDestination,
  enabledLabs: ReadonlySet<LabId>
): boolean {
  return !sub.lab || enabledLabs.has(sub.lab);
}
