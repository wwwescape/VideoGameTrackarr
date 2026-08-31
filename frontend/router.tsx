import { createBrowserRouter } from "react-router-dom";
import AppShell from "./AppShell";
import AccessoryDetails from "./components/AccessoryDetails";
import AddAccessoryPage from "./components/AddAccessoryPage";
import AddDevicePage from "./components/AddDevicePage";
import AddGame from "./components/AddGame";
import CollectionPage from "./components/CollectionPage";
import CollectionsPage from "./components/CollectionsPage";
import ComparePage from "./components/ComparePage";
import DashboardPage from "./components/DashboardPage";
import DeviceDetails from "./components/DeviceDetails";
import DuplicatesPage from "./components/DuplicatesPage";
import EditAccessoryPage from "./components/EditAccessoryPage";
import EditDevicePage from "./components/EditDevicePage";
import EditGamePage from "./components/EditGamePage";
import GameDetails from "./components/GameDetails";
import GameList from "./components/GameList";
import HardwarePage from "./components/HardwarePage";
import InsightsPage from "./components/InsightsPage";
import IntegrationsPage from "./components/IntegrationsPage";
import MissingDlcPage from "./components/MissingDlcPage";
import NotFoundPage from "./components/NotFoundPage";
import OrphanedAccessoriesPage from "./components/OrphanedAccessoriesPage";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import SeriesDetailPage from "./components/SeriesDetailPage";
import SeriesPage from "./components/SeriesPage";
import About from "./components/About";
import JobsPage from "./components/JobsPage";
import PublicGamesPage from "./components/PublicGamesPage";
import PublicHardwarePage from "./components/PublicHardwarePage";
import Settings from "./components/Settings";
import SteamSyncPage from "./components/SteamSyncPage";
import OnSalePage from "./components/OnSalePage";
import TagManagerPage from "./components/TagManagerPage";
import PublicShell from "./PublicShell";
import {
  accessoryCrumbs,
  addAccessoryCrumbs,
  addDeviceCrumbs,
  addGameCrumbs,
  collectionCrumbs,
  collectionsCrumbs,
  compareCrumbs,
  dashboardCrumbs,
  deviceDetailCrumbs,
  duplicatesCrumbs,
  editAccessoryCrumbs,
  editDeviceCrumbs,
  editGameCrumbs,
  franchiseCrumbs,
  aboutCrumbs,
  gameDetailCrumbs,
  gamesCrumbs,
  hardwareCrumbs,
  insightsCrumbs,
  integrationsCrumbs,
  jobsCrumbs,
  missingDlcCrumbs,
  notFoundCrumbs,
  onSaleCrumbs,
  orphanedAccessoriesCrumbs,
  seriesCrumbs,
  settingsCrumbs,
  steamSyncCrumbs,
  tagManagerCrumbs,
} from "./navigation/breadcrumbConfig";
import Login from "./pages/Login";
import ProtectedLayout from "./routes/ProtectedLayout";
import { useTranslation } from "react-i18next";

// The AppShell-internal "*" catch-all (a wrong URL, not a crash) — kept inside AppShell so
// the nav/header stay visible, unlike RouteErrorBoundary which renders standalone.
const NotFoundRouteElement = () => {
  const { t } = useTranslation();
  return (
    <NotFoundPage
      title={t("errors.pageNotFoundTitle")}
      message={t("errors.pageNotFoundMessage")}
      actionLabel={t("errors.backToDashboard")}
      actionTo="/"
    />
  );
};

const router = createBrowserRouter([
  // Each top-level branch gets its own errorElement (rather than one shared pathless wrapper
  // route) so a render-time crash lands on this same friendly fallback instead of React
  // Router's raw, unstyled default error screen — regardless of which branch it happened in.
  { path: "/login", element: <Login />, errorElement: <RouteErrorBoundary /> },
  {
    // Deliberately outside ProtectedLayout — no auth check, since access here is gated by
    // the unlisted token in the path instead (see backend/app/api/routes/public.py).
    element: <PublicShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/public/:token/games", element: <PublicGamesPage /> },
      { path: "/public/:token/hardware", element: <PublicHardwarePage /> },
    ],
  },
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage />, handle: { crumbs: dashboardCrumbs } },
          { path: "/games", element: <GameList />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/add", element: <AddGame />, handle: { crumbs: addGameCrumbs } },
          {
            path: "/game/:identifier",
            element: <GameDetails />,
            handle: { crumbs: gameDetailCrumbs },
          },
          {
            path: "/game/:identifier/edit",
            element: <EditGamePage />,
            handle: { crumbs: editGameCrumbs },
          },
          {
            path: "/addon/:identifier",
            element: <GameDetails />,
            handle: { crumbs: gameDetailCrumbs },
          },
          { path: "/games/series", element: <SeriesPage />, handle: { crumbs: seriesCrumbs } },
          {
            path: "/games/series/:seriesSlug",
            element: <SeriesDetailPage />,
            handle: { crumbs: franchiseCrumbs },
          },
          {
            path: "/games/collections",
            element: <CollectionsPage />,
            handle: { crumbs: collectionsCrumbs },
          },
          {
            path: "/games/collections/:collectionSlug",
            element: <CollectionPage />,
            handle: { crumbs: collectionCrumbs },
          },
          { path: "/hardware", element: <HardwarePage />, handle: { crumbs: hardwareCrumbs } },
          {
            path: "/hardware/device/add",
            element: <AddDevicePage />,
            handle: { crumbs: addDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/add",
            element: <AddAccessoryPage />,
            handle: { crumbs: addAccessoryCrumbs },
          },
          {
            path: "/hardware/device/:identifier",
            element: <DeviceDetails />,
            handle: { crumbs: deviceDetailCrumbs },
          },
          {
            path: "/hardware/device/:identifier/edit",
            element: <EditDevicePage />,
            handle: { crumbs: editDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier",
            element: <AccessoryDetails />,
            handle: { crumbs: accessoryCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier/edit",
            element: <EditAccessoryPage />,
            handle: { crumbs: editAccessoryCrumbs },
          },
          { path: "/insights", element: <InsightsPage />, handle: { crumbs: insightsCrumbs } },
          {
            path: "/insights/duplicates",
            element: <DuplicatesPage />,
            handle: { crumbs: duplicatesCrumbs },
          },
          {
            path: "/insights/missing-dlc",
            element: <MissingDlcPage />,
            handle: { crumbs: missingDlcCrumbs },
          },
          {
            path: "/insights/orphaned-accessories",
            element: <OrphanedAccessoriesPage />,
            handle: { crumbs: orphanedAccessoriesCrumbs },
          },
          {
            path: "/insights/steam-sync",
            element: <SteamSyncPage />,
            handle: { crumbs: steamSyncCrumbs },
          },
          {
            path: "/insights/on-sale",
            element: <OnSalePage />,
            handle: { crumbs: onSaleCrumbs },
          },
          { path: "/compare", element: <ComparePage />, handle: { crumbs: compareCrumbs } },
          { path: "/settings", element: <Settings />, handle: { crumbs: settingsCrumbs } },
          {
            path: "/settings/tags",
            element: <TagManagerPage />,
            handle: { crumbs: tagManagerCrumbs },
          },
          { path: "/settings/jobs", element: <JobsPage />, handle: { crumbs: jobsCrumbs } },
          {
            path: "/settings/integrations",
            element: <IntegrationsPage />,
            handle: { crumbs: integrationsCrumbs },
          },
          { path: "/about", element: <About />, handle: { crumbs: aboutCrumbs } },
          { path: "*", element: <NotFoundRouteElement />, handle: { crumbs: notFoundCrumbs } },
        ],
      },
    ],
  },
]);

export default router;
