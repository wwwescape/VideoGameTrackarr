import { createBrowserRouter } from "react-router-dom";
import AppShell from "./AppShell";
import OverviewPage from "./components/OverviewPage";
import NotFoundPage from "./components/NotFoundPage";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import PublicShell from "./PublicShell";
import {
  accessoryCrumbs,
  addAccessoryCrumbs,
  addDeviceCrumbs,
  addGameCrumbs,
  igdbPreviewCrumbs,
  collectionCrumbs,
  collectionsCrumbs,
  compareCrumbs,
  dashboardCrumbs,
  deviceDetailCrumbs,
  duplicatesCrumbs,
  editAccessoryCrumbs,
  editDeviceCrumbs,
  editGameCrumbs,
  eventDetailCrumbs,
  eventsCrumbs,
  franchiseCrumbs,
  aboutCrumbs,
  gameDetailCrumbs,
  gamesCrumbs,
  hardwareCrumbs,
  insightsCrumbs,
  integrationsCrumbs,
  jobsCrumbs,
  emulationCrumbs,
  missingAddonsCrumbs,
  notFoundCrumbs,
  onSaleCrumbs,
  orphanedAccessoriesCrumbs,
  saleTrackedCrumbs,
  salesIgnoredCrumbs,
  gameShelfCrumbs,
  labsCrumbs,
  gameCasesCrumbs,
  platformCrumbs,
  platformsCrumbs,
  seriesCrumbs,
  settingsCrumbs,
  steamSyncCrumbs,
  igdbImportCrumbs,
  tagManagerCrumbs,
  toyCrumbs,
  toysToLifeCrumbs,
  toysToLifeLineCrumbs,
} from "./navigation/breadcrumbConfig";
import Login from "./pages/Login";
import { page, preloadPages } from "./routes/lazyPage";
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
      actionLabel={t("errors.backToOverview")}
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
      { path: "/public/:token/games", lazy: page(() => import("./components/PublicGamesPage")) },
      {
        path: "/public/:token/games/:gameId",
        lazy: page(() => import("./components/PublicGameDetailsPage")),
      },
      { path: "/public/:token/shelf", lazy: page(() => import("./components/PublicShelfPage")) },
      {
        path: "/public/:token/hardware",
        lazy: page(() => import("./components/PublicHardwarePage")),
      },
    ],
  },
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <OverviewPage />, handle: { crumbs: dashboardCrumbs } },
          {
            path: "/events",
            lazy: page(() => import("./components/EventsPage")),
            handle: { crumbs: eventsCrumbs },
          },
          {
            path: "/events/:identifier",
            lazy: page(() => import("./components/EventDetails")),
            handle: { crumbs: eventDetailCrumbs },
          },
          {
            path: "/games",
            lazy: page(() => import("./components/GameList")),
            handle: { crumbs: gamesCrumbs },
          },
          {
            path: "/games/add",
            lazy: page(() => import("./components/AddGame")),
            handle: { crumbs: addGameCrumbs },
          },
          {
            path: "/games/shelf",
            lazy: page(() => import("./components/GameShelfPage")),
            handle: { crumbs: gameShelfCrumbs },
          },
          {
            path: "/games/add/igdb/:igdbId",
            lazy: page(() => import("./components/IgdbGamePreviewPage")),
            handle: { crumbs: igdbPreviewCrumbs },
          },
          {
            path: "/game/:identifier",
            lazy: page(() => import("./components/GameDetails")),
            handle: { crumbs: gameDetailCrumbs },
          },
          {
            path: "/game/:identifier/edit",
            lazy: page(() => import("./components/EditGamePage")),
            handle: { crumbs: editGameCrumbs },
          },
          {
            path: "/addon/:identifier",
            lazy: page(() => import("./components/GameDetails")),
            handle: { crumbs: gameDetailCrumbs },
          },
          {
            path: "/games/series",
            lazy: page(() => import("./components/SeriesPage")),
            handle: { crumbs: seriesCrumbs },
          },
          {
            path: "/games/series/:seriesSlug",
            lazy: page(() => import("./components/SeriesDetailPage")),
            handle: { crumbs: franchiseCrumbs },
          },
          {
            path: "/games/platforms",
            lazy: page(() => import("./components/PlatformsPage")),
            handle: { crumbs: platformsCrumbs },
          },
          {
            path: "/games/platforms/:platformSlug",
            lazy: page(() => import("./components/PlatformDetailPage")),
            handle: { crumbs: platformCrumbs },
          },
          {
            path: "/games/collections",
            lazy: page(() => import("./components/CollectionsPage")),
            handle: { crumbs: collectionsCrumbs },
          },
          {
            path: "/games/collections/:collectionSlug",
            lazy: page(() => import("./components/CollectionPage")),
            handle: { crumbs: collectionCrumbs },
          },
          {
            path: "/toys-to-life",
            lazy: page(() => import("./components/ToysToLifePage")),
            handle: { crumbs: toysToLifeCrumbs },
          },
          {
            path: "/toys-to-life/:line",
            lazy: page(() => import("./components/ToysToLifeLinePage")),
            handle: { crumbs: toysToLifeLineCrumbs },
          },
          {
            path: "/toys-to-life/:line/:pack",
            lazy: page(() => import("./components/ToysToLifePackDetails")),
            handle: { crumbs: toyCrumbs },
          },
          {
            path: "/hardware",
            lazy: page(() => import("./components/HardwarePage")),
            handle: { crumbs: hardwareCrumbs },
          },
          {
            path: "/hardware/device/add",
            lazy: page(() => import("./components/AddDevicePage")),
            handle: { crumbs: addDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/add",
            lazy: page(() => import("./components/AddAccessoryPage")),
            handle: { crumbs: addAccessoryCrumbs },
          },
          {
            path: "/hardware/device/:identifier",
            lazy: page(() => import("./components/DeviceDetails")),
            handle: { crumbs: deviceDetailCrumbs },
          },
          {
            path: "/hardware/device/:identifier/edit",
            lazy: page(() => import("./components/EditDevicePage")),
            handle: { crumbs: editDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier",
            lazy: page(() => import("./components/AccessoryDetails")),
            handle: { crumbs: accessoryCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier/edit",
            lazy: page(() => import("./components/EditAccessoryPage")),
            handle: { crumbs: editAccessoryCrumbs },
          },
          {
            path: "/insights",
            lazy: page(() => import("./components/InsightsPage")),
            handle: { crumbs: insightsCrumbs },
          },
          {
            path: "/insights/duplicates",
            lazy: page(() => import("./components/DuplicatesPage")),
            handle: { crumbs: duplicatesCrumbs },
          },
          {
            path: "/insights/missing-addons",
            lazy: page(() => import("./components/MissingAddonsPage")),
            handle: { crumbs: missingAddonsCrumbs },
          },
          {
            path: "/insights/orphaned-accessories",
            lazy: page(() => import("./components/OrphanedAccessoriesPage")),
            handle: { crumbs: orphanedAccessoriesCrumbs },
          },
          {
            path: "/insights/on-sale",
            lazy: page(() => import("./components/OnSalePage")),
            handle: { crumbs: onSaleCrumbs },
          },
          {
            path: "/compare",
            lazy: page(() => import("./components/ComparePage")),
            handle: { crumbs: compareCrumbs },
          },
          {
            path: "/settings",
            lazy: page(() => import("./components/Settings")),
            handle: { crumbs: settingsCrumbs },
          },
          {
            path: "/settings/tags",
            lazy: page(() => import("./components/TagManagerPage")),
            handle: { crumbs: tagManagerCrumbs },
          },
          {
            path: "/settings/labs",
            lazy: page(() => import("./components/LabsPage")),
            handle: { crumbs: labsCrumbs },
          },
          {
            path: "/settings/jobs",
            lazy: page(() => import("./components/JobsPage")),
            handle: { crumbs: jobsCrumbs },
          },
          {
            path: "/settings/integrations",
            lazy: page(() => import("./components/IntegrationsPage")),
            handle: { crumbs: integrationsCrumbs },
          },
          {
            path: "/settings/emulation",
            lazy: page(() => import("./components/EmulationPage")),
            handle: { crumbs: emulationCrumbs },
          },
          {
            path: "/settings/game-cases",
            lazy: page(() => import("./components/GameCasesPage")),
            handle: { crumbs: gameCasesCrumbs },
          },
          {
            path: "/settings/igdb-import",
            lazy: page(() => import("./components/IgdbImportPage")),
            handle: { crumbs: igdbImportCrumbs },
          },
          {
            path: "/settings/steam-sync",
            lazy: page(() => import("./components/SteamSyncPage")),
            handle: { crumbs: steamSyncCrumbs },
          },
          {
            path: "/settings/sale-tracked",
            lazy: page(() => import("./components/SaleTrackedPage")),
            handle: { crumbs: saleTrackedCrumbs },
          },
          {
            path: "/settings/sales-ignored",
            lazy: page(() => import("./components/SalesIgnoredListPage")),
            handle: { crumbs: salesIgnoredCrumbs },
          },
          {
            path: "/about",
            lazy: page(() => import("./components/About")),
            handle: { crumbs: aboutCrumbs },
          },
          { path: "*", element: <NotFoundRouteElement />, handle: { crumbs: notFoundCrumbs } },
        ],
      },
    ],
  },
]);

// Once the first screen is up, fetch every other page's code in the background. Skipped on
// share pages, whose visitors never see the app.
if (!window.location.pathname.startsWith("/public/")) {
  window.addEventListener("load", () => setTimeout(preloadPages, 1500));
}

export default router;
