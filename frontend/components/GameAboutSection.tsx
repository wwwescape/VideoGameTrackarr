import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import igdbLogo from "../assets/igdb-logo.png";
import type { GameCompany, GameDetail, IgdbReleaseRegion } from "../api/types";
import { gameIdentifier } from "../utils/identifiers";
import { getAddonType, getReleaseYear, isAddon } from "../utils/utils";
import ExpandableText from "./ExpandableText";
import ScreenshotGallery from "./ScreenshotGallery";

interface GameAboutSectionProps {
  game: GameDetail;
}

const COMPANY_ROLE_LABEL: Record<string, string> = {
  developer: "Developed by",
  publisher: "Published by",
  porting: "Ported by",
  supporting: "Additional work by",
};

const RELEASE_REGION_LABEL: Record<IgdbReleaseRegion, string> = {
  europe: "Europe",
  north_america: "North America",
  australia: "Australia",
  new_zealand: "New Zealand",
  japan: "Japan",
  china: "China",
  asia: "Asia",
  worldwide: "Worldwide",
};

const GameAboutSection = ({ game }: GameAboutSectionProps) => {
  const theme = useTheme();
  const isAddonGame = isAddon(game);

  const companiesByRole = game.companies.reduce<Record<string, GameCompany[]>>((acc, company) => {
    (acc[company.role] ??= []).push(company);
    return acc;
  }, {});

  const hasStoryline = game.storyline && game.storyline !== game.summary;

  return (
    <>
      <CardContent>
        {game.igdbId === null ? (
          <Tooltip title="Added by hand, not linked to an IGDB entry — use Link to IGDB under the poster to link it.">
            <Chip label="Custom" size="small" variant="outlined" sx={{ mb: 1 }} />
          </Tooltip>
        ) : null}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <Typography variant="h4" component="h1" sx={{ lineHeight: 1.15 }}>
            {game.name}{" "}
            <Typography variant="subtitle2" color="text.secondary" component="span">
              ({getReleaseYear(game.firstReleaseDate) ?? "Unknown"})
            </Typography>
          </Typography>
          {game.rating !== null ? (
            <Chip label={`IGDB Rating: ${Math.round(game.rating)}/100`} size="small" variant="outlined" color="primary" />
          ) : null}
        </Stack>
        {game.edition ? (
          <Typography variant="subtitle1" color="text.secondary">
            {game.edition}
          </Typography>
        ) : null}
        {isAddonGame ? (
          <Typography variant="subtitle1" color="text.secondary" component="span">
            {getAddonType(game)}
            {game.parentGameId !== null ? (
              <>
                {" for "}
                <Link
                  to={`/game/${gameIdentifier({ slug: game.parentGameSlug, uuid: game.parentGameUuid!, name: game.parentGameName! })}`}
                  style={{ color: theme.palette.text.primary }}
                >
                  {game.parentGameName}
                </Link>
              </>
            ) : game.displayParentGameId !== null ? (
              <>
                {" for "}
                <Link
                  to={`/game/${gameIdentifier({ slug: game.displayParentGameSlug, uuid: game.displayParentGameUuid!, name: game.displayParentGameName! })}`}
                  style={{ color: theme.palette.text.primary }}
                >
                  {game.displayParentGameName}
                </Link>
              </>
            ) : game.externalParentName ? (
              <>
                {" for "}
                {game.externalParentIgdbUrl ? (
                  <Tooltip title="Not in your library — opens the original's IGDB page">
                    <a
                      href={game.externalParentIgdbUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: theme.palette.text.primary }}
                    >
                      {game.externalParentName}
                    </a>
                  </Tooltip>
                ) : (
                  game.externalParentName
                )}
              </>
            ) : null}
          </Typography>
        ) : null}

        {Object.entries(companiesByRole).map(([role, companies]) => (
          <Stack key={role} direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary" component="span">
              {COMPANY_ROLE_LABEL[role] ?? role}:
            </Typography>
            {companies.map((company, index) => (
              <Stack key={company.id} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                {company.logoUrl ? (
                  <Box
                    component="img"
                    src={company.logoUrl}
                    alt=""
                    sx={{
                      height: 22,
                      width: "auto",
                      maxWidth: 64,
                      objectFit: "contain",
                      borderRadius: 0.5,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                ) : null}
                <Typography variant="body2" color="text.secondary" component="span">
                  {company.name}
                  {index < companies.length - 1 ? "," : ""}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ))}
        {game.platforms.length > 0 ? (
          <Typography variant="body2" color="text.secondary" component="div">
            Available on: {game.platforms.map((platform) => platform.name).join(", ")}
          </Typography>
        ) : null}

        {game.genres.length > 0 || game.franchises.length > 0 || game.collections.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
            {game.genres.map((genre) => (
              <Chip key={`genre-${genre.id}`} label={genre.name} size="small" variant="outlined" />
            ))}
            {game.franchises.map((franchise) => (
              <Chip
                key={`franchise-${franchise.id}`}
                label={`Series: ${franchise.name}`}
                size="small"
                component={Link}
                to={`/games/series/${franchise.slug ?? ""}`}
                clickable
              />
            ))}
            {game.collections.map((collection) => (
              <Chip
                key={`collection-${collection.id}`}
                label={`Collection: ${collection.name}`}
                size="small"
                component={Link}
                to={`/games/collections/${collection.slug ?? ""}`}
                clickable
              />
            ))}
          </Stack>
        ) : null}

        {game.releaseDates.length > 1 ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
            {game.releaseDates.map((releaseDate) => (
              <Chip
                key={releaseDate.id}
                size="small"
                variant="outlined"
                label={`${releaseDate.platformName ?? "Unknown platform"}: ${releaseDate.human ?? "TBD"}${
                  releaseDate.releaseRegion ? ` (${RELEASE_REGION_LABEL[releaseDate.releaseRegion]})` : ""
                }`}
              />
            ))}
          </Stack>
        ) : null}
      </CardContent>
      <Divider />
      <CardContent>{game.summary ? <ExpandableText text={game.summary} /> : null}</CardContent>
      {hasStoryline ? (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Storyline
            </Typography>
            <ExpandableText text={game.storyline as string} />
          </CardContent>
        </>
      ) : null}
      {game.screenshotUrls.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <ScreenshotGallery urls={game.screenshotUrls} altPrefix={game.name} />
          </CardContent>
        </>
      ) : null}
      {game.artworkUrls.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <ScreenshotGallery urls={game.artworkUrls} altPrefix={game.name} title="Artwork" />
          </CardContent>
        </>
      ) : null}
      {game.videos.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Videos
            </Typography>
            <Stack spacing={0.5}>
              {game.videos.map((video) => (
                <a
                  key={video.id}
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: theme.palette.primary.main }}
                >
                  {video.name ?? "Watch on YouTube"}
                </a>
              ))}
            </Stack>
          </CardContent>
        </>
      ) : null}
      <Divider />
      <CardContent>
        {game.igdbUrl && (
          <Tooltip title="View more details on IGDB.com">
            <a href={game.igdbUrl} target="_blank" rel="noreferrer" style={{ color: theme.palette.text.primary }}>
              <img src={igdbLogo} alt="View more details on IGDB.com" style={{ width: "64px" }} />
            </a>
          </Tooltip>
        )}
      </CardContent>
    </>
  );
};

export default GameAboutSection;
