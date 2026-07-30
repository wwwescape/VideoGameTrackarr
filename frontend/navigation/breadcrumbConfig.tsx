import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { Params } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccessoryItem } from "../hooks/useAccessories";
import { useCollection, useFranchise } from "../hooks/useCatalogBrowse";
import { useGame } from "../hooks/useGames";
import { useDeviceItem } from "../hooks/useDevice";

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export type CrumbsFn = (params: Params<string>, t: TFunction) => Crumb[];

export interface RouteHandle {
  crumbs: CrumbsFn;
}

const GameCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: game } = useGame(identifier);
  return <>{game?.name ?? t("common.loading")}</>;
};

const FranchiseCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { t } = useTranslation();
  const { data: franchise } = useFranchise(slug);
  return <>{franchise?.name ?? t("common.loading")}</>;
};

const CollectionCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { t } = useTranslation();
  const { data: collection } = useCollection(slug);
  return <>{collection?.name ?? t("common.loading")}</>;
};

const DeviceCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: device } = useDeviceItem(identifier);
  return <>{device?.officialName ?? t("common.loading")}</>;
};

const AccessoryCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: accessory } = useAccessoryItem(identifier);
  return <>{accessory?.officialName ?? t("common.loading")}</>;
};

// Each leaf route in router.tsx owns its full trail (rather than nested routes inheriting
// from ancestors) since the route tree here is flat — there's no /games/:id nesting to walk.
export const gamesCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.games") }];

export const addGameCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.games"), to: "/games" },
  { label: t("nav.addGame") },
];

export const gameDetailCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.games"), to: "/games" },
  { label: <GameCrumbLabel identifier={params.identifier} /> },
];

export const editGameCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.games"), to: "/games" },
  { label: <GameCrumbLabel identifier={params.identifier} />, to: `/game/${params.identifier}` },
  { label: t("breadcrumbs.edit") },
];

export const seriesCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.games"), to: "/games" },
  { label: t("nav.series") },
];

export const franchiseCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.series"), to: "/games/series" },
  { label: <FranchiseCrumbLabel slug={params.seriesSlug} /> },
];

export const collectionsCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.games"), to: "/games" },
  { label: t("nav.collections") },
];

export const collectionCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.collections"), to: "/games/collections" },
  { label: <CollectionCrumbLabel slug={params.collectionSlug} /> },
];

export const hardwareCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.hardware") }];

export const addDeviceCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  { label: t("nav.addDevice") },
];

export const addAccessoryCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  { label: t("nav.addAccessory") },
];

export const deviceDetailCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  { label: <DeviceCrumbLabel identifier={params.identifier} /> },
];

export const accessoryCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  { label: <AccessoryCrumbLabel identifier={params.identifier} /> },
];

export const editDeviceCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  {
    label: <DeviceCrumbLabel identifier={params.identifier} />,
    to: `/hardware/device/${params.identifier}`,
  },
  { label: t("breadcrumbs.edit") },
];

export const editAccessoryCrumbs: CrumbsFn = (params, t) => [
  { label: t("nav.hardware"), to: "/hardware" },
  {
    label: <AccessoryCrumbLabel identifier={params.identifier} />,
    to: `/hardware/accessory/${params.identifier}`,
  },
  { label: t("breadcrumbs.edit") },
];

export const insightsCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.insights") }];

export const duplicatesCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.insights"), to: "/insights" },
  { label: t("nav.duplicates") },
];

export const missingDlcCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.insights"), to: "/insights" },
  { label: t("nav.missingDlc") },
];

export const orphanedAccessoriesCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.insights"), to: "/insights" },
  { label: t("nav.orphanedAccessories") },
];

export const dashboardCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.dashboard") }];

export const compareCrumbs: CrumbsFn = (_params, t) => [{ label: t("breadcrumbs.compareGames") }];

export const settingsCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.settings") }];

export const aboutCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.about") }];
