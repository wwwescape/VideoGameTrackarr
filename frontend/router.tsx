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
import MissingDlcPage from "./components/MissingDlcPage";
import OrphanedAccessoriesPage from "./components/OrphanedAccessoriesPage";
import SeriesDetailPage from "./components/SeriesDetailPage";
import SeriesPage from "./components/SeriesPage";
import About from "./components/About";
import Settings from "./components/Settings";
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
  missingDlcCrumbs,
  orphanedAccessoriesCrumbs,
  seriesCrumbs,
  settingsCrumbs,
} from "./navigation/breadcrumbConfig";
import Login from "./pages/Login";
import ProtectedLayout from "./routes/ProtectedLayout";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage />, handle: { crumbs: dashboardCrumbs } },
          { path: "/games", element: <GameList />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/add", element: <AddGame />, handle: { crumbs: addGameCrumbs } },
          { path: "/game/:identifier", element: <GameDetails />, handle: { crumbs: gameDetailCrumbs } },
          { path: "/game/:identifier/edit", element: <EditGamePage />, handle: { crumbs: editGameCrumbs } },
          { path: "/addon/:identifier", element: <GameDetails />, handle: { crumbs: gameDetailCrumbs } },
          { path: "/games/series", element: <SeriesPage />, handle: { crumbs: seriesCrumbs } },
          {
            path: "/games/series/:seriesSlug",
            element: <SeriesDetailPage />,
            handle: { crumbs: franchiseCrumbs },
          },
          { path: "/games/collections", element: <CollectionsPage />, handle: { crumbs: collectionsCrumbs } },
          {
            path: "/games/collections/:collectionSlug",
            element: <CollectionPage />,
            handle: { crumbs: collectionCrumbs },
          },
          { path: "/hardware", element: <HardwarePage />, handle: { crumbs: hardwareCrumbs } },
          { path: "/hardware/device/add", element: <AddDevicePage />, handle: { crumbs: addDeviceCrumbs } },
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
          { path: "/insights/duplicates", element: <DuplicatesPage />, handle: { crumbs: duplicatesCrumbs } },
          { path: "/insights/missing-dlc", element: <MissingDlcPage />, handle: { crumbs: missingDlcCrumbs } },
          {
            path: "/insights/orphaned-accessories",
            element: <OrphanedAccessoriesPage />,
            handle: { crumbs: orphanedAccessoriesCrumbs },
          },
          { path: "/compare", element: <ComparePage />, handle: { crumbs: compareCrumbs } },
          { path: "/settings", element: <Settings />, handle: { crumbs: settingsCrumbs } },
          { path: "/about", element: <About />, handle: { crumbs: aboutCrumbs } },
        ],
      },
    ],
  },
]);

export default router;
