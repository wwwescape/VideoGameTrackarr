import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoneIcon from "@mui/icons-material/Done";
import { useTheme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import { green } from "@mui/material/colors";
import { getAddonType } from "../utils/utils";
import { getReleaseYear } from "../utils/utils";

const AddedGameButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(green[500]),
  backgroundColor: green[500],
  "&:hover": {
    backgroundColor: green[500],
  },
}));

const GameCard = ({ game, context, contextFunction }) => {
  const theme = useTheme();

  console.log(game);

  const originalWidth = 264;
  const originalHeight = 352;
  const reducedWidth = originalWidth * 0.75;
  const reducedHeight = (reducedWidth / originalWidth) * originalHeight;

  const isAddon = !(
    game.is_dlc === 0 &&
    game.is_expansion === 0 &&
    game.is_pack === 0
  );

  return (
    <Card
      style={{
        position: "relative",
        borderRadius: "10px",
        border: `1px solid ${theme.palette.text.primary}`,
        width: `${reducedWidth}px`,
      }}
    >
      {/* Top Left Overlay Icons */}
      {(context === "list" || context === "addon") &&
      (game.wishlisted > 0 || game.wishlisted_addons > 0) ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "rgba(255, 255, 255)",
            borderRadius: "0 0 10px 0",
          }}
        >
          {game.wishlisted_addons > 0 ? (
            <Badge
              badgeContent={game.wishlisted_addons}
              color="primary"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
            >
              <IconButton>
                <Tooltip title="Added to wishlist">
                  <>
                    <StarIcon style={{ color: "orange" }} />
                  </>
                </Tooltip>
              </IconButton>
            </Badge>
          ) : (
            <IconButton>
              <Tooltip title="Added to wishlist">
                <>
                  <StarIcon style={{ color: "orange" }} />
                </>
              </Tooltip>
            </IconButton>
          )}
        </div>
      ) : null}

      {/* Top Right Overlay Icons */}
      {(context === "list" || context === "addon") &&
      (game.owned > 0 || game.owned_addons > 0) ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "rgba(255, 255, 255)",
            borderRadius: "0 0 0 10px",
          }}
        >
          {game.owned_addons > 0 ? (
            <Badge
              badgeContent={game.owned_addons}
              color="primary"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
            >
              <IconButton>
                <Tooltip title="Added to collection">
                  <>
                    <CheckCircleIcon style={{ color: "green" }} />
                  </>
                </Tooltip>
              </IconButton>
            </Badge>
          ) : (
            <IconButton>
              <Tooltip title="Added to collection">
                <>
                  <CheckCircleIcon style={{ color: "green" }} />
                </>
              </Tooltip>
            </IconButton>
          )}
        </div>
      ) : null}

      <Tooltip
        title={`${game.name} (${getReleaseYear(game.first_release_date)})`}
      >
        <CardMedia
          component="img"
          alt={game.name}
          image={game.coverUrl}
          width={reducedWidth}
          height={reducedHeight}
          onClick={() => {
            switch (context) {
              case "list":
              case "addon":
              case "added":
                contextFunction();
                break;
              default:
                break;
            }
          }}
          style={{
            cursor:
              context === "list" || context === "addon" || context === "added"
                ? "pointer"
                : "default",
            borderBottom: `1px solid ${theme.palette.text.primary}`,
          }}
        />
      </Tooltip>
      <CardContent>
        <Tooltip
          title={`${game.name} (${getReleaseYear(game.first_release_date)})`}
        >
          <Typography
            variant="subtitle2"
            component="div"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <strong>{game.name}</strong>
          </Typography>
        </Tooltip>
        <Typography variant="subtitle2" color="textSecondary" component="div">
          {getReleaseYear(game.first_release_date)}
        </Typography>
        {isAddon && (
          <Typography variant="subtitle2" color="textSecondary" component="div">
            {getAddonType(game)}
          </Typography>
        )}
        {context === "add" || context === "added" ? (
          <>
            {context === "added" ? (
              <AddedGameButton
                variant="contained"
                fullWidth
                style={{ cursor: "default", marginTop: "10px" }}
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
                style={{ marginTop: "10px" }}
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
