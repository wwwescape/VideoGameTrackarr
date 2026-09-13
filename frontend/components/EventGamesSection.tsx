import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { EventGameTile } from "../api/types";
import { resolveAssetUrl } from "../api/client";
import { gameIdentifier } from "../utils/identifiers";

interface EventGamesSectionProps {
  games: EventGameTile[];
}

const GameTile = ({ game }: { game: EventGameTile }) => {
  const cover = (
    <>
      <Box
        sx={{
          position: "relative",
          aspectRatio: "3 / 4",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "action.hover",
        }}
      >
        {game.coverUrl ? (
          <Box
            component="img"
            src={resolveAssetUrl(game.coverUrl) ?? undefined}
            alt={game.name ?? ""}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <ImageNotSupportedOutlinedIcon />
          </Box>
        )}
      </Box>
      <Typography variant="body2" noWrap sx={{ mt: 0.5 }}>
        {game.name}
      </Typography>
    </>
  );

  // Only clickable when this IGDB game id resolves to a locally-known Game row — a per-row
  // lookup already resolved server-side, not a bulk cross-reference "insight".
  if (game.gameId !== null && game.gameSlug !== undefined && game.gameUuid) {
    return (
      <Box
        component={Link}
        to={`/game/${gameIdentifier({ slug: game.gameSlug, uuid: game.gameUuid, name: game.name ?? "" })}`}
        sx={{ display: "block", color: "inherit", textDecoration: "none" }}
      >
        {cover}
      </Box>
    );
  }

  return <Box>{cover}</Box>;
};

const EventGamesSection = ({ games }: EventGamesSectionProps) => {
  const { t } = useTranslation();

  if (games.length === 0) return null;

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {t("events.games.heading")}
      </Typography>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {games.map((game) => (
          <Grid key={game.igdbGameId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <GameTile game={game} />
          </Grid>
        ))}
      </Grid>
    </>
  );
};

export default EventGamesSection;
