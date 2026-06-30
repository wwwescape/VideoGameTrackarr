import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import { green } from "@mui/material/colors";
import { styled, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
import { resolveAssetUrl } from "../api/client";
import type { GameCategory, PlayStatus } from "../api/types";
import { getAddonType, getReleaseYear, isAddon } from "../utils/utils";
import OwnershipBadges from "./OwnershipBadges";

const PLAY_STATUS_LABELS: Record<PlayStatus, string> = {
  none: "",
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  abandoned: "Abandoned",
};

const PLAY_STATUS_COLORS: Record<PlayStatus, "default" | "info" | "success" | "error"> = {
  none: "default",
  backlog: "default",
  playing: "info",
  completed: "success",
  abandoned: "error",
};

const AddedGameButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(green[500]),
  backgroundColor: green[500],
  "&:hover": {
    backgroundColor: green[500],
  },
}));

export type GameCardContext = "list" | "addon" | "added" | "add";

export interface GameCardGame {
  name: string;
  firstReleaseDate: number | null;
  coverUrl: string | null;
  category?: GameCategory | null;
  owned?: boolean;
  wishlisted?: boolean;
  playStatus?: PlayStatus | null;
}

interface GameCardProps {
  game: GameCardGame;
  context: GameCardContext;
  contextFunction: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const GameCard = ({ game, context, contextFunction, selectable, selected, onToggleSelect }: GameCardProps) => {
  const theme = useTheme();
  const showsBadges = (context === "list" || context === "addon") && !selectable;
  const isClickable = context === "list" || context === "addon" || context === "added";
  const releaseYear = getReleaseYear(game.firstReleaseDate);

  const handleCardActivate = () => {
    if (selectable) {
      onToggleSelect?.();
      return;
    }
    if (isClickable) {
      contextFunction();
    }
  };

  return (
    <Card
      sx={{
        position: "relative",
        borderRadius: 2,
        border: selected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": {
          transform: isClickable || selectable ? "translateY(-2px)" : "none",
          boxShadow: isClickable || selectable ? theme.shadows[6] : theme.shadows[1],
        },
      }}
    >
      {selectable ? (
        <Checkbox
          checked={Boolean(selected)}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
          aria-label={selected ? `Deselect ${game.name}` : `Select ${game.name}`}
          sx={{
            position: "absolute",
            top: 4,
            left: 4,
            zIndex: 1,
            bgcolor: "background.paper",
            borderRadius: "50%",
            p: 0.25,
            "&:hover": { bgcolor: "background.paper" },
          }}
        />
      ) : null}

      <Tooltip title={`${game.name} (${releaseYear ?? "?"})`}>
        <Box
          onClick={handleCardActivate}
          sx={{
            position: "relative",
            aspectRatio: "3 / 4",
            overflow: "hidden",
            borderBottom: `1px solid ${theme.palette.divider}`,
            cursor: isClickable || selectable ? "pointer" : "default",
          }}
        >
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
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="caption">No cover</Typography>
            </Box>
          )}
        </Box>
      </Tooltip>

      <OwnershipBadges owned={showsBadges && Boolean(game.owned)} wishlisted={showsBadges && Boolean(game.wishlisted)} />

      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Tooltip title={`${game.name} (${releaseYear ?? "?"})`}>
          <Typography
            variant="subtitle2"
            component="div"
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.35,
            }}
          >
            <strong>{game.name}</strong>
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" component="div">
          {releaseYear ?? "Unknown year"}
        </Typography>
        {/* Always rendered, even for plain main games — keeping every card's text block the
            same height is what keeps a mixed-category row's bottom edges lined up (the
            virtualized grid sizes each row to its tallest card, but shorter cards don't
            stretch to match, so a card that skips this line visibly falls short). */}
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ visibility: isAddon(game) ? "visible" : "hidden" }}
        >
          {getAddonType(game) ?? " "}
        </Typography>
        {showsBadges ? (
          // Same fix as the addon-type line above: always reserve the chip's slot (just
          // invisible when there's no play status) instead of mounting it conditionally,
          // which is what broke row alignment again as soon as a "Completed"/etc. chip
          // showed up on only some cards in a row.
          <Chip
            label={game.playStatus && game.playStatus !== "none" ? PLAY_STATUS_LABELS[game.playStatus] : " "}
            color={game.playStatus && game.playStatus !== "none" ? PLAY_STATUS_COLORS[game.playStatus] : "default"}
            size="small"
            sx={{ mt: 0.75, visibility: game.playStatus && game.playStatus !== "none" ? "visible" : "hidden" }}
          />
        ) : null}
        {context === "add" || context === "added" ? (
          <>
            {context === "added" ? (
              <AddedGameButton
                variant="contained"
                fullWidth
                sx={{ cursor: "default", mt: 1.25 }}
                startIcon={<DoneIcon />}
                onClick={() => {}}
                disableRipple
                disableElevation
              >
                Added
              </AddedGameButton>
            ) : (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1.25 }}
                startIcon={<AddIcon />}
                onClick={contextFunction}
              >
                Add
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default GameCard;
