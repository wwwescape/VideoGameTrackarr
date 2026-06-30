import type { ReactNode } from "react";
import type { Params } from "react-router-dom";
import { useAccessoryItem } from "../hooks/useAccessories";
import { useCollection, useFranchise } from "../hooks/useCatalogBrowse";
import { useGame } from "../hooks/useGames";
import { useDeviceItem } from "../hooks/useDevice";

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export type CrumbsFn = (params: Params<string>) => Crumb[];

export interface RouteHandle {
  crumbs: CrumbsFn;
}

const GameCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { data: game } = useGame(identifier);
  return <>{game?.name ?? "Loading..."}</>;
};

const FranchiseCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { data: franchise } = useFranchise(slug);
  return <>{franchise?.name ?? "Loading..."}</>;
};

const CollectionCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { data: collection } = useCollection(slug);
  return <>{collection?.name ?? "Loading..."}</>;
};

const DeviceCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { data: device } = useDeviceItem(identifier);
  return <>{device?.officialName ?? "Loading..."}</>;
};

const AccessoryCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { data: accessory } = useAccessoryItem(identifier);
  return <>{accessory?.officialName ?? "Loading..."}</>;
};

// Each leaf route in router.tsx owns its full trail (rather than nested routes inheriting
// from ancestors) since the route tree here is flat — there's no /games/:id nesting to walk.
export const gamesCrumbs: CrumbsFn = () => [{ label: "Games" }];

export const addGameCrumbs: CrumbsFn = () => [{ label: "Games", to: "/games" }, { label: "Add Game" }];

export const gameDetailCrumbs: CrumbsFn = (params) => [
  { label: "Games", to: "/games" },
  { label: <GameCrumbLabel identifier={params.identifier} /> },
];

export const editGameCrumbs: CrumbsFn = (params) => [
  { label: "Games", to: "/games" },
  { label: <GameCrumbLabel identifier={params.identifier} />, to: `/game/${params.identifier}` },
  { label: "Edit" },
];

export const seriesCrumbs: CrumbsFn = () => [
  { label: "Games", to: "/games" },
  { label: "Series" },
];

export const franchiseCrumbs: CrumbsFn = (params) => [
  { label: "Series", to: "/games/series" },
  { label: <FranchiseCrumbLabel slug={params.seriesSlug} /> },
];

export const collectionsCrumbs: CrumbsFn = () => [
  { label: "Games", to: "/games" },
  { label: "Collections" },
];

export const collectionCrumbs: CrumbsFn = (params) => [
  { label: "Collections", to: "/games/collections" },
  { label: <CollectionCrumbLabel slug={params.collectionSlug} /> },
];

export const hardwareCrumbs: CrumbsFn = () => [{ label: "Hardware" }];

export const addDeviceCrumbs: CrumbsFn = () => [{ label: "Hardware", to: "/hardware" }, { label: "Add Device" }];

export const addAccessoryCrumbs: CrumbsFn = () => [
  { label: "Hardware", to: "/hardware" },
  { label: "Add Accessory" },
];

export const deviceDetailCrumbs: CrumbsFn = (params) => [
  { label: "Hardware", to: "/hardware" },
  { label: <DeviceCrumbLabel identifier={params.identifier} /> },
];

export const accessoryCrumbs: CrumbsFn = (params) => [
  { label: "Hardware", to: "/hardware" },
  { label: <AccessoryCrumbLabel identifier={params.identifier} /> },
];

export const editDeviceCrumbs: CrumbsFn = (params) => [
  { label: "Hardware", to: "/hardware" },
  {
    label: <DeviceCrumbLabel identifier={params.identifier} />,
    to: `/hardware/device/${params.identifier}`,
  },
  { label: "Edit" },
];

export const editAccessoryCrumbs: CrumbsFn = (params) => [
  { label: "Hardware", to: "/hardware" },
  {
    label: <AccessoryCrumbLabel identifier={params.identifier} />,
    to: `/hardware/accessory/${params.identifier}`,
  },
  { label: "Edit" },
];

export const insightsCrumbs: CrumbsFn = () => [{ label: "Insights" }];

export const duplicatesCrumbs: CrumbsFn = () => [{ label: "Insights", to: "/insights" }, { label: "Duplicates" }];

export const missingDlcCrumbs: CrumbsFn = () => [
  { label: "Insights", to: "/insights" },
  { label: "Missing DLC" },
];

export const orphanedAccessoriesCrumbs: CrumbsFn = () => [
  { label: "Insights", to: "/insights" },
  { label: "Orphaned Accessories" },
];

export const dashboardCrumbs: CrumbsFn = () => [{ label: "Dashboard" }];

export const compareCrumbs: CrumbsFn = () => [{ label: "Compare Games" }];

export const settingsCrumbs: CrumbsFn = () => [{ label: "Settings" }];

export const aboutCrumbs: CrumbsFn = () => [{ label: "About" }];
