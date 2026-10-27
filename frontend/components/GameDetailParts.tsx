import type { ReactNode } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CheckIcon from "@mui/icons-material/Check";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import ExtensionIcon from "@mui/icons-material/ExtensionOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SellIcon from "@mui/icons-material/SellOutlined";
import StarIcon from "@mui/icons-material/StarBorder";
import VideogameAssetIcon from "@mui/icons-material/VideogameAssetOutlined";
import Box from "@mui/material/Box";

import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { GameAboutData, GameCompany, GameSummary, IgdbReleaseRegion, PlayStatus } from "../api/types";
import type { Crumb } from "../navigation/breadcrumbConfig";
import { gameIdentifier } from "../utils/identifiers";
import { formatReleaseDate, getAddonType, isAddon } from "../utils/utils";
import { DetailHero, Pill, Section } from "./Detail";
import ExpandableText from "./ExpandableText";
import { useGameStoreLinks } from "./GameStoreLinks";
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
  // A share-link page: the parent game links to its share page, and series/collection pills
  // aren't links (those pages need a login).
  publicToken?: string;
}

export const GameHero = ({ game, status, crumbs, preview = false, publicToken }: GameHeroProps) => {
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

  const linksCatalogPages = !preview && publicToken === undefined;
  const gameLink = (id: number, slug: string | null, uuid: string, name: string) =>
    publicToken !== undefined ? `/public/${publicToken}/games/${id}` : `/game/${gameIdentifier({ slug, uuid, name })}`;
  const parentLink =
    game.parentGameId !== null
      ? { name: game.parentGameName, to: gameLink(game.parentGameId, game.parentGameSlug, game.parentGameUuid!, game.parentGameName!) }
      : game.displayParentGameId !== null
        ? {
            name: game.displayParentGameName,
            to: gameLink(game.displayParentGameId, game.displayParentGameSlug, game.displayParentGameUuid!, game.displayParentGameName!),
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

  const storeLinks = useGameStoreLinks(game);
  const pills: ReactNode[] = [];
  if (!preview && status.owned) {
    pills.push(<Pill key="owned" tone="owned" icon={<CheckIcon />}>{t("ownershipBadges.ownedTooltip")}</Pill>);
  }
  if (!preview && status.wishlisted) {
    pills.push(<Pill key="wish" tone="wishlist" icon={<FavoriteIcon />}>{t("ownershipBadges.wishlistTooltip")}</Pill>);
  }
  if (playStatus) {
    pills.push(<Pill key="play" tone="accent">{t(PLAY_STATUS_KEYS[playStatus])}</Pill>);
  }
  if (missing) pills.push(<Pill key="missing" tone="accent">{t("games.card.missingLabel")}</Pill>);
  if (game.igdbId === null) {
    pills.push(<Pill key="custom" title={t("games.about.customTooltip")}>{t("games.about.customLabel")}</Pill>);
  }
  if (status.isOnSale) pills.push(<Pill key="sale" tone="success" icon={<SellIcon />}>{t("games.card.onSaleLabel")}</Pill>);
  // IGDB's two ratings as its own game page shows them: out of 10, one decimal, each with how
  // many ratings it's based on in its tooltip.
  const igdbRatingPill = (key: string, label: string, rating: number | null, count: number | null) => {
    if (rating === null) return;
    const score = (Math.round(rating) / 10).toFixed(1);
    pills.push(
      <Pill key={key} icon={<StarIcon />} title={t("games.about.igdbRatingCountTooltip", { count: count ?? 0 })}>
        {t(label, { rating: score })}
      </Pill>
    );
  };
  igdbRatingPill("igdb-members", "games.about.igdbMemberRatingLabel", game.igdbRating, game.igdbRatingCount);
  igdbRatingPill("igdb-critics", "games.about.igdbCriticRatingLabel", game.igdbCriticRating, game.igdbCriticRatingCount);
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
      <Pill key={`series-${franchise.id}`} icon={<AccountTreeIcon />} to={linksCatalogPages ? `/games/series/${franchise.slug ?? ""}` : undefined}>
        {t("games.about.seriesLabel", { name: franchise.name })}
      </Pill>
    )
  );
  game.collections.forEach((collection) =>
    pills.push(
      <Pill
        key={`collection-${collection.id}`}
        icon={<CollectionsBookmarkIcon />}
        to={linksCatalogPages ? `/games/collections/${collection.slug ?? ""}` : undefined}
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
      links={
        storeLinks.length ? (
          <>
            {storeLinks.map((link) => (
              <Pill key={link.key} href={link.href} title={link.title} icon={<OpenInNewIcon />}>
                {link.label}
              </Pill>
            ))}
          </>
        ) : undefined
      }
    />
  );
};

// A small titled card under About (Platforms & release dates).
const AboutCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, px: 1.75, py: 1.5, minWidth: 0 }}>
    <Typography component="h3" sx={{ fontSize: 11.5, color: "vgt.text3", mb: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

// About: summary and storyline, then one row per platform with its release dates (IGDB lists
// the platforms and the release dates separately, and they usually name the same platforms).
// Developer, publisher and genres are in the hero, and the store links are chips there too.
export const GameAboutBlock = ({ game }: { game: GameAboutData }) => {
  const { t, i18n } = useTranslation();
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
  // A row per platform from either list, by platform name (IGDB's own order is arbitrary), with
  // release dates without a platform last. A platform's dates read earliest first; one with no
  // known date (IGDB's "TBD") or no release date at all leaves the date blank.
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  const datesByPlatform = new Map<string | null, GameAboutData["releaseDates"]>(
    game.platforms.map((platform) => [platform.name, []])
  );
  for (const releaseDate of game.releaseDates) {
    const dates = datesByPlatform.get(releaseDate.platformName) ?? [];
    if (releaseDate.date !== null) dates.push(releaseDate);
    datesByPlatform.set(releaseDate.platformName, dates);
  }
  const platformRows = [...datesByPlatform]
    .map(([name, dates]) => ({ name, dates: dates.sort((a, b) => (a.date as number) - (b.date as number)) }))
    .sort((a, b) => byName(a.name ?? "\uffff", b.name ?? "\uffff"));

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
      {platformRows.length ? (
        <Box sx={{ mt: 2, maxWidth: 900 }}>
          <AboutCard title={t("games.detail.platformsReleaseDatesTitle")}>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {platformRows.map((row, index) => (
                <Box
                  component="li"
                  key={row.name ?? ""}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    columnGap: 1.5,
                    py: 0.75,
                    borderTop: index ? 1 : 0,
                    borderColor: "divider",
                    fontSize: 13.5,
                  }}
                >
                  <Box sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.name ?? t("games.about.unknownPlatform")}
                  </Box>
                  <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.dates.map((releaseDate) => (
                      <div key={releaseDate.id}>
                        {releaseDate.human ?? formatReleaseDate(releaseDate.date as number, i18n.language)}
                        {releaseDate.releaseRegion ? (
                          <Box component="span" sx={{ color: "vgt.text3", ml: 0.75 }}>
                            {regionLabel[releaseDate.releaseRegion]}
                          </Box>
                        ) : null}
                      </div>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </AboutCard>
        </Box>
      ) : null}
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
