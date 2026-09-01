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

// Each *CrumbLabel below falls back to "…NotFoundTitle" on isError rather than
// "common.loading" — a nonexistent entity's query settles as an error, not just missing
// data, so without this check the crumb would say "Loading…" forever (same underlying bug
// as the page body's own isError handling in GameDetails.tsx etc., just visible here too).
const GameCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: game, isError } = useGame(identifier);
  return <>{isError ? t("errors.gameNotFoundTitle") : (game?.name ?? t("common.loading"))}</>;
};

const FranchiseCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { t } = useTranslation();
  const { data: franchise, isError } = useFranchise(slug);
  return (
    <>{isError ? t("errors.seriesNotFoundTitle") : (franchise?.name ?? t("common.loading"))}</>
  );
};

const CollectionCrumbLabel = ({ slug }: { slug: string | undefined }) => {
  const { t } = useTranslation();
  const { data: collection, isError } = useCollection(slug);
  return (
    <>{isError ? t("errors.collectionNotFoundTitle") : (collection?.name ?? t("common.loading"))}</>
  );
};

const DeviceCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: device, isError } = useDeviceItem(identifier);
  return (
    <>{isError ? t("errors.deviceNotFoundTitle") : (device?.officialName ?? t("common.loading"))}</>
  );
};

const AccessoryCrumbLabel = ({ identifier }: { identifier: string | undefined }) => {
  const { t } = useTranslation();
  const { data: accessory, isError } = useAccessoryItem(identifier);
  return (
    <>
      {isError
        ? t("errors.accessoryNotFoundTitle")
        : (accessory?.officialName ?? t("common.loading"))}
    </>
  );
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

export const onSaleCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.insights"), to: "/insights" },
  { label: t("nav.onSale") },
];

export const dashboardCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.dashboard") }];

export const compareCrumbs: CrumbsFn = (_params, t) => [{ label: t("breadcrumbs.compareGames") }];

export const settingsCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.settings") }];

export const tagManagerCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.settings"), to: "/settings" },
  { label: t("nav.tagManager") },
];

export const jobsCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.settings"), to: "/settings" },
  { label: t("nav.jobs") },
];

export const integrationsCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.settings"), to: "/settings" },
  { label: t("nav.integrations") },
];

export const steamSyncCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.settings"), to: "/settings" },
  { label: t("nav.steamSync") },
];

export const salesIgnoredCrumbs: CrumbsFn = (_params, t) => [
  { label: t("nav.settings"), to: "/settings" },
  { label: t("nav.salesIgnored") },
];

export const aboutCrumbs: CrumbsFn = (_params, t) => [{ label: t("nav.about") }];

export const notFoundCrumbs: CrumbsFn = (_params, t) => [{ label: t("errors.pageNotFoundTitle") }];
