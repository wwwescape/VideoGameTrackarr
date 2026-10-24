import type { ReactNode } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CheckIcon from "@mui/icons-material/Check";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import ExtensionIcon from "@mui/icons-material/ExtensionOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import SellIcon from "@mui/icons-material/SellOutlined";
import StarIcon from "@mui/icons-material/StarBorder";
import VideogameAssetIcon from "@mui/icons-material/VideogameAssetOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { GameAboutData, GameCompany, GameSummary, IgdbReleaseRegion, PlayStatus } from "../api/types";
import type { Crumb } from "../navigation/breadcrumbConfig";
import { gameIdentifier } from "../utils/identifiers";
import { getAddonType, isAddon } from "../utils/utils";
import { DetailHero, Facts, Pill, Section } from "./Detail";
import ExpandableText from "./ExpandableText";
import { GameStoreLinks } from "./GameAboutSection";
import OwnershipBadges from "./OwnershipBadges";
import ScreenshotGallery from "./ScreenshotGallery";
import VideoGallery from "./VideoGallery";

// IGDB links many things under a parent game (bundles, mods, seasons...); the add-ons strip
// shows the actual DLC, expansions and packs.
export const ADDON_DISPLAY_CATEGORIES = new Set<GameSummary["category"]>(["dlc_addon", "expansion", "pack"]);

const PLAY_STATUS_KEYS: Record<Exclude<PlayStatus, "none">, string> = {
  backlog: "games.card.playStatusBacklog",
  playing: "games.card.playStatusPlaying",
  completed: "games.card.playStatusCompleted",
  abandoned: "games.card.playStatusAbandoned",
};

// The library state a stored game has and an IGDB preview doesn't.
export interface GameHeroStatus {
  coverUrl: string | null;
  owned?: boolean;
  wishlisted?: boolean;
  playStatus?: PlayStatus | null;
  isOnSale?: boolean;
  autoDiscovered?: boolean;
  // Platforms of the user's own copies (owned or wishlisted).
  copyPlatforms?: string[];
}

// Hero backdrop order: IGDB artwork, then the first screenshot, then the cover blurred.
export function gameBackdrop(game: Pick<GameAboutData, "artworkUrls" | "screenshotUrls">, coverUrl: string | null) {
  const sharp = game.artworkUrls[0] ?? game.screenshotUrls[0];
  if (sharp) return { url: sharp, blur: false };
  const cover = resolveAssetUrl(coverUrl);
  return cover ? { url: cover, blur: true } : null;
}

const companiesByRole = (companies: GameCompany[]) =>
  companies.reduce<Record<string, string[]>>((acc, company) => {
    (acc[company.role] ??= []).push(company.name);
    return acc;
  }, {});

interface GameHeroProps {
  game: GameAboutData;
  status: GameHeroStatus;
  crumbs: Crumb[];
  // An IGDB preview: its series/collection pages may not exist locally, so those pills
  // aren't links.
  preview?: boolean;
}

export const GameHero = ({ game, status, crumbs, preview = false }: GameHeroProps) => {
  const { t, i18n } = useTranslation();
  const greyscale = !preview && !status.owned && !status.wishlisted;
  const missing = greyscale && status.autoDiscovered;
  const roles = companiesByRole(game.companies);
  const released = game.firstReleaseDate
    ? new Date(game.firstReleaseDate * 1000).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t("common.unknown");

  const parentLink =
    game.parentGameId !== null
      ? { name: game.parentGameName, to: `/game/${gameIdentifier({ slug: game.parentGameSlug, uuid: game.parentGameUuid!, name: game.parentGameName! })}` }
      : game.displayParentGameId !== null
        ? {
            name: game.displayParentGameName,
            to: `/game/${gameIdentifier({ slug: game.displayParentGameSlug, uuid: game.displayParentGameUuid!, name: game.displayParentGameName! })}`,
          }
        : game.externalParentName
          ? { name: game.externalParentName, href: game.externalParentIgdbUrl ?? undefined }
          : null;

  const playStatus = status.playStatus && status.playStatus !== "none" ? status.playStatus : null;
  const cover = resolveAssetUrl(status.coverUrl);

  const media = (
    <Box
      sx={{
        position: "relative",
        aspectRatio: "3 / 4",
        borderRadius: 2.5,
        overflow: "hidden",
        border: 1,
        borderColor: "vgt.borderStrong",
        bgcolor: "vgt.surface2",
        boxShadow: "0 18px 40px rgba(0,0,0,.4)",
        display: "grid",
        placeItems: "center",
        color: "text.secondary",
      }}
    >
      {cover ? (
        <Box
          component="img"
          src={cover}
          alt={game.name}
          sx={{ width: "100%", height: "100%", objectFit: "cover", filter: greyscale ? "grayscale(1)" : "none" }}
        />
      ) : (
        <Box sx={{ textAlign: "center", p: 1 }}>
          <ImageNotSupportedOutlinedIcon fontSize="large" />
          <Typography variant="caption" component="div">
            {t("games.coverCard.noImageAvailable")}
          </Typography>
        </Box>
      )}
      {!preview ? <OwnershipBadges owned={Boolean(status.owned)} wishlisted={Boolean(status.wishlisted)} /> : null}
    </Box>
  );

  const pills: ReactNode[] = [];
  if (!preview && status.owned) {
    pills.push(<Pill key="owned" tone="owned" icon={<CheckIcon />}>{t("ownershipBadges.ownedTooltip")}</Pill>);
  }
  if (!preview && status.wishlisted) {
    pills.push(<Pill key="wish" icon={<FavoriteIcon />}>{t("ownershipBadges.wishlistTooltip")}</Pill>);
  }
  if (playStatus) {
    pills.push(<Pill key="play" tone="accent">{t(PLAY_STATUS_KEYS[playStatus])}</Pill>);
  }
  if (missing) pills.push(<Pill key="missing" tone="accent">{t("games.card.missingLabel")}</Pill>);
  if (game.igdbId === null) {
    pills.push(<Pill key="custom" title={t("games.about.customTooltip")}>{t("games.about.customLabel")}</Pill>);
  }
  if (status.isOnSale) pills.push(<Pill key="sale" tone="success" icon={<SellIcon />}>{t("games.card.onSaleLabel")}</Pill>);
  if (game.rating !== null) {
    pills.push(
      <Pill key="rating" icon={<StarIcon />}>
        {t("games.about.igdbRatingLabel", { rating: Math.round(game.rating) })}
      </Pill>
    );
  }
  (status.copyPlatforms ?? []).forEach((platform) =>
    pills.push(<Pill key={`platform-${platform}`} icon={<VideogameAssetIcon />}>{platform}</Pill>)
  );
  if (isAddon(game) && parentLink) {
    pills.push(
      <Pill key="parent" icon={<ExtensionIcon />} to={!preview ? parentLink.to : undefined} href={parentLink.href}>
        {getAddonType(game)}
        {t("games.about.forConnector")}
        {parentLink.name}
      </Pill>
    );
  }
  game.franchises.forEach((franchise) =>
    pills.push(
      <Pill key={`series-${franchise.id}`} icon={<AccountTreeIcon />} to={!preview ? `/games/series/${franchise.slug ?? ""}` : undefined}>
        {t("games.about.seriesLabel", { name: franchise.name })}
      </Pill>
    )
  );
  game.collections.forEach((collection) =>
    pills.push(
      <Pill
        key={`collection-${collection.id}`}
        icon={<CollectionsBookmarkIcon />}
        to={!preview ? `/games/collections/${collection.slug ?? ""}` : undefined}
      >
        {t("games.about.collectionLabel", { name: collection.name })}
      </Pill>
    )
  );

  return (
    <DetailHero
      backdrop={gameBackdrop(game, status.coverUrl)}
      media={media}
      mediaWidth={{ xs: 112, md: 210 }}
      crumbs={crumbs}
      title={game.name}
      subline={[
        released,
        game.edition,
        roles.developer?.join(", "),
        roles.publisher && roles.publisher.join(", ") !== roles.developer?.join(", ") ? roles.publisher.join(", ") : null,
        game.genres.slice(0, 3).map((genre) => genre.name).join(", "),
      ]}
      pills={pills}
    />
  );
};

// About: summary and storyline, the catalog facts (companies by role, platforms, genres),
// release dates by region, and the store links.
export const GameAboutBlock = ({ game }: { game: GameAboutData }) => {
  const { t } = useTranslation();
  const roles = companiesByRole(game.companies);
  const roleLabel: Record<string, string> = {
    developer: t("games.about.companyRoleDeveloper"),
    publisher: t("games.about.companyRolePublisher"),
    porting: t("games.about.companyRolePorting"),
    supporting: t("games.about.companyRoleSupporting"),
  };
  const regionLabel: Record<IgdbReleaseRegion, string> = {
    europe: t("games.about.regionEurope"),
    north_america: t("games.about.regionNorthAmerica"),
    australia: t("games.about.regionAustralia"),
    new_zealand: t("games.about.regionNewZealand"),
    japan: t("games.about.regionJapan"),
    china: t("games.about.regionChina"),
    asia: t("games.about.regionAsia"),
    worldwide: t("games.about.regionWorldwide"),
  };
  const hasStoryline = game.storyline && game.storyline !== game.summary;

  return (
    <Section id="about" title={t("games.detail.aboutTitle")}>
      {game.summary ? (
        <Box sx={{ color: "text.secondary", maxWidth: 900 }}>
          <ExpandableText text={game.summary} />
        </Box>
      ) : null}
      {hasStoryline ? (
        <Box sx={{ mt: 2, maxWidth: 900 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("games.about.storylineTitle")}
          </Typography>
          <Box sx={{ color: "text.secondary" }}>
            <ExpandableText text={game.storyline as string} />
          </Box>
        </Box>
      ) : null}
      <Box sx={{ mt: 2 }}>
        <Facts
          facts={[
            ...Object.entries(roles).map(([role, names]): [string, ReactNode] => [roleLabel[role] ?? role, names.join(", ")]),
            [t("games.detail.platformsLabel"), game.platforms.map((platform) => platform.name).join(", ")],
            [t("games.detail.genresLabel"), game.genres.map((genre) => genre.name).join(", ")],
          ]}
        />
      </Box>
      {game.releaseDates.length > 1 ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("games.detail.releaseDatesTitle")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {game.releaseDates.map((releaseDate) => (
              <Chip
                key={releaseDate.id}
                size="small"
                variant="outlined"
                label={`${releaseDate.platformName ?? t("games.about.unknownPlatform")}: ${releaseDate.human ?? t("games.about.tbd")}${
                  releaseDate.releaseRegion ? ` (${regionLabel[releaseDate.releaseRegion]})` : ""
                }`}
              />
            ))}
          </Box>
        </Box>
      ) : null}
      <Box sx={{ mt: 2 }}>
        <GameStoreLinks game={game} />
      </Box>
    </Section>
  );
};

// Screenshots, artwork and videos, each its own section when there are any.
export const GameMediaSections = ({ game }: { game: GameAboutData }) => {
  const { t } = useTranslation();
  return (
    <>
      {game.screenshotUrls.length > 0 ? (
        <Section id="screenshots" title={t("screenshotGallery.title")}>
          <ScreenshotGallery urls={game.screenshotUrls} altPrefix={game.name} hideTitle />
        </Section>
      ) : null}
      {game.artworkUrls.length > 0 ? (
        <Section id="artwork" title={t("games.about.artworkTitle")}>
          <ScreenshotGallery urls={game.artworkUrls} altPrefix={game.name} hideTitle />
        </Section>
      ) : null}
      {game.videos.length > 0 ? (
        <Section id="videos" title={t("games.about.videosTitle")}>
          <VideoGallery videos={game.videos} hideTitle />
        </Section>
      ) : null}
    </>
  );
};
