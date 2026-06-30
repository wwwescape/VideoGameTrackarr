import type { ReactNode } from "react";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CollectionsIcon from "@mui/icons-material/Collections";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ExtensionOffIcon from "@mui/icons-material/ExtensionOff";
import GamesIcon from "@mui/icons-material/Games";
import InsightsIcon from "@mui/icons-material/Insights";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import MemoryIcon from "@mui/icons-material/Memory";
import SettingsIcon from "@mui/icons-material/Settings";

export interface NavSubDestination {
  to: string;
  label: string;
  icon: ReactNode;
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
export const navDestinations: NavDestination[] = [
  { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
  {
    to: "/games",
    label: "Games",
    icon: <GamesIcon />,
    subItems: [
      { to: "/games/add", label: "Add Game", icon: <AddIcon /> },
      { to: "/games/collections", label: "Collections", icon: <CollectionsIcon /> },
      { to: "/games/series", label: "Series", icon: <AccountTreeIcon /> },
    ],
  },
  {
    to: "/hardware",
    label: "Hardware",
    icon: <MemoryIcon />,
    subItems: [
      { to: "/hardware/device/add", label: "Add Device", icon: <AddIcon /> },
      { to: "/hardware/accessory/add", label: "Add Accessory", icon: <AddIcon /> },
    ],
  },
  {
    to: "/insights",
    label: "Insights",
    icon: <InsightsIcon />,
    subItems: [
      { to: "/insights/duplicates", label: "Duplicates", icon: <ContentCopyIcon /> },
      { to: "/insights/missing-dlc", label: "Missing DLC", icon: <ExtensionOffIcon /> },
      { to: "/insights/orphaned-accessories", label: "Orphaned Accessories", icon: <LinkOffIcon /> },
    ],
  },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
];
