import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { resolveAssetUrl } from "../api/client";
import type { GameDetail } from "../api/types";
import OwnershipBadges from "./OwnershipBadges";

interface GameCoverCardProps {
  game: Pick<GameDetail, "name" | "coverUrl" | "owned" | "wishlisted">;
}

const GameCoverCard = ({ game }: GameCoverCardProps) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        // Used to cap out at a fixed 260/320px below the md breakpoint, centered with
        // empty space on either side — looked fine on an actual narrow phone, but on a
        // wide desktop window any width below md (zoomed in, or just resized) left the
        // cover stuck at that fixed size while the grid column around it kept growing,
        // exactly the "doesn't scale with the rest of the page" effect. Always filling the
        // column's actual width is correct at every breakpoint, not just md and up.
        width: "100%",
        maxWidth: "100%",
        position: "relative",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <OwnershipBadges owned={game.owned} wishlisted={game.wishlisted} />
      <Tooltip title={game.name}>
        {/* aspect-ratio lives on this wrapper, not the <img> itself — see GameCard.tsx for why
            (aspect-ratio + object-fit directly on a replaced element is the combination
            that's been flaky across browsers under non-100% zoom). */}
        <Box sx={{ position: "relative", aspectRatio: "3 / 4", overflow: "hidden" }}>
          {game.coverUrl ? (
            <CardMedia
              component="img"
              alt={game.name}
              image={resolveAssetUrl(game.coverUrl) ?? undefined}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "action.hover",
                color: "text.secondary",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                p: 2,
                textAlign: "center",
              }}
            >
              <ImageNotSupportedOutlinedIcon fontSize="large" />
              <Typography variant="body2">No Image Available</Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    </Card>
  );
};

export default GameCoverCard;
