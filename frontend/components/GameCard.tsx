import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import { green } from "@mui/material/colors";
import Skeleton from "@mui/material/Skeleton";
import { styled } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { GameCategory, PlayStatus } from "../api/types";
import { getAddonType, getReleaseYear, isAddon } from "../utils/utils";
import OwnershipBadges from "./OwnershipBadges";

const PLAY_STATUS_LABEL_KEYS: Record<PlayStatus, string> = {
  none: "",
  backlog: "games.card.playStatusBacklog",
  playing: "games.card.playStatusPlaying",
  completed: "games.card.playStatusCompleted",
  abandoned: "games.card.playStatusAbandoned",
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

// Below this card width the badges shrink and the hover actions drop their labels. Measured
// on the card itself (a CSS container query), so it holds at any column count or card size.
const SMALL_CARD = "@container (max-width: 170px)";

export type GameCardContext = "list" | "addon" | "added" | "add" | "public";

export interface GameCardGame {
  name: string;
  firstReleaseDate: number | null;
  coverUrl: string | null;
  category?: GameCategory | null;
  owned?: boolean;
  wishlisted?: boolean;
  // Distinguishes a Collection/Series "what's missing" discovery (not yet claimed) from a
  // manually-added game that just isn't owned/wishlisted yet — both are greyscaled, but only
  // the former gets the "Missing" chip. See the isGreyscale/showMissingChip split below.
  autoDiscovered?: boolean;
  playStatus?: PlayStatus | null;
  // Named to match GameSummary's own field so a GameSummary object can be passed straight
  // through as `game` everywhere (list, collections, series, addons, release calendar)
  // without every call site having to remap it — only hand-built card objects (the
  // Dashboard's On Sale sections, built from OnSaleItem rather than a full GameSummary)
  // need to set it explicitly.
  isOnSale?: boolean;
  // Null for a manually-added (non-IGDB) game, which gets the "Custom" chip. Left undefined
  // by hand-built card objects (e.g. the Dashboard's On Sale sections), which never show it.
  igdbId?: number | null;
}

interface GameCardProps {
  game: GameCardGame;
  context: GameCardContext;
  // Optional: a "public" context card is only clickable when this is passed.
  contextFunction?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  // Overrides the "add" context's button label/icon (default: common.add / AddIcon) — for a
  // picker that isn't actually adding a new game, e.g. RelinkSteamEntryDialog.tsx picking an
  // *existing* local game to repoint a Steam match at. Has no effect on any other context.
  actionLabel?: string;
  actionIcon?: ReactNode;
  // "add" context only: opens the result when its cover is clicked (Add Game's IGDB
  // preview page), separately from contextFunction, which stays the Add button's action.
  onOpen?: () => void;
  // Shortcut buttons shown over the cover on hover (the Games list's Edit/Play), hidden while
  // selecting. See GameCardHoverAction.
  hoverActions?: ReactNode;
}

// The 2026 card: the cover carries it. A 3:4 cover with today's badges and chips on it, then
// the name, the year (and add-on type), and a reserved play-status slot so a row's cards
// always line up.
const GameCard = ({
  game,
  context,
  contextFunction,
  selectable,
  selected,
  onToggleSelect,
  actionLabel,
  actionIcon,
  onOpen,
  hoverActions,
}: GameCardProps) => {
  const { t } = useTranslation();
  // Resets on every mount, including the virtualized grid recycling a card as it scrolls
  // back into view (e.g. after a fast scroll + browser back-navigation) — a cached image
  // still resolves near-instantly, so the skeleton is only visible for genuinely-loading
  // covers, not a permanent flash on every re-render.
  const [coverLoaded, setCoverLoaded] = useState(false);
  const showsBadges =
    (context === "list" || context === "addon" || context === "public") && !selectable;
  // Same gate as showsBadges — the add/added search-result contexts don't carry real
  // ownership data, so there's nothing meaningful to grey out there.
  const isGreyscale = showsBadges && !game.owned && !game.wishlisted;
  // A subset of isGreyscale: only a still-unclaimed Collection/Series "what's missing"
  // discovery gets the chip — a manually-added game that just isn't owned/wishlisted yet is
  // greyscaled the same way, but showing "Missing" on it would be wrong (nothing's missing;
  // the user added it on purpose and just hasn't marked ownership yet).
  const showMissingChip = isGreyscale && Boolean(game.autoDiscovered);
  // Shares the bottom-right corner with the Missing chip — never both in practice (a
  // discovered game always comes from IGDB), but Missing wins if they ever did.
  const showCustomChip = showsBadges && game.igdbId === null && !showMissingChip;
  const showSaleChip = showsBadges && Boolean(game.isOnSale);
  const opensSeparately = context === "add" && onOpen !== undefined;
  const isClickable =
    context === "list" ||
    context === "addon" ||
    context === "added" ||
    (context === "public" && contextFunction !== undefined) ||
    opensSeparately;
  const isInteractive = isClickable || Boolean(selectable);
  const releaseYear = getReleaseYear(game.firstReleaseDate);
  const playStatus = game.playStatus && game.playStatus !== "none" ? game.playStatus : null;

  const handleCardActivate = () => {
    if (selectable) {
      onToggleSelect?.();
      return;
    }
    if (opensSeparately) {
      onOpen?.();
    } else if (isClickable) {
      contextFunction?.();
    }
  };

  const coverChip = (label: string, bgcolor: string, color = "#fff") => (
    <Box
      component="span"
      sx={{
        height: 22,
        px: 1,
        borderRadius: 999,
        bgcolor,
        color,
        fontSize: 11.5,
        fontWeight: 650,
        lineHeight: "22px",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxShadow: (theme) => `0 0 0 1px ${theme.palette.vgt.glassLine}`,
        [SMALL_CARD]: { height: 19, lineHeight: "19px", fontSize: 10.5, px: 0.875 },
      }}
    >
      {label}
    </Box>
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        containerType: "inline-size",
        "&:hover .vgt-card-cover": isInteractive ? { outlineColor: "vgt.borderStrong" } : undefined,
        "&:hover .vgt-card-actions, &:focus-within .vgt-card-actions": { opacity: 1 },
      }}
    >
      {selectable ? (
        <Checkbox
          checked={Boolean(selected)}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
          // A top-level aria-label prop on MUI's Checkbox never reaches the underlying
          // <input> — slotProps.input is required for it to actually become the
          // checkbox's accessible name (confirmed via a real screen-reader-invisible
          // checkbox found while adding AddGame.tsx's own selection mode).
          slotProps={{
            input: {
              "aria-label": selected
                ? t("games.card.deselectAriaLabel", { name: game.name })
                : t("games.card.selectAriaLabel", { name: game.name }),
            },
          }}
          sx={{
            position: "absolute",
            top: 4,
            left: 4,
            zIndex: 3,
            bgcolor: "background.paper",
            borderRadius: "50%",
            p: 0.25,
            "&:hover": { bgcolor: "background.paper" },
          }}
        />
      ) : null}

      <Tooltip title={t("games.card.nameYearTooltip", { name: game.name, year: releaseYear ?? "?" })}>
        <Box
          className="vgt-card-cover"
          onClick={handleCardActivate}
          role={isInteractive ? "button" : undefined}
          tabIndex={isInteractive ? 0 : undefined}
          aria-label={isInteractive ? game.name : undefined}
          onKeyDown={(event) => {
            if (isInteractive && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              handleCardActivate();
            }
          }}
          sx={{
            position: "relative",
            aspectRatio: "3 / 4",
            overflow: "hidden",
            borderRadius: 2,
            bgcolor: "vgt.surface2",
            outline: selected ? "2px solid" : "1px solid",
            outlineColor: selected ? "primary.main" : "divider",
            outlineOffset: selected ? "-2px" : "-1px",
            cursor: isInteractive ? "pointer" : "default",
            transition: "outline-color 120ms ease",
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          {game.coverUrl ? (
            <>
              {!coverLoaded && (
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                />
              )}
              <Box
                component="img"
                alt={game.name}
                src={resolveAssetUrl(game.coverUrl) ?? undefined}
                loading="lazy"
                onLoad={() => setCoverLoaded(true)}
                onError={() => setCoverLoaded(true)}
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: coverLoaded ? 1 : 0,
                  transition: "opacity 150ms ease",
                  filter: isGreyscale ? "grayscale(1)" : "none",
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                color: "text.secondary",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                textAlign: "center",
                typography: "caption",
              }}
            >
              {t("games.card.noCover")}
            </Box>
          )}

          <Box
            sx={{
              "& > div": { [SMALL_CARD]: { width: 24, height: 24, top: 6 } },
              "& > div:first-of-type:not(:last-of-type)": { [SMALL_CARD]: { left: 6 } },
              "& svg": { [SMALL_CARD]: { fontSize: "15px !important" } },
            }}
          >
            <OwnershipBadges
              owned={showsBadges && Boolean(game.owned)}
              wishlisted={showsBadges && Boolean(game.wishlisted)}
            />
          </Box>

          {showSaleChip || showMissingChip || showCustomChip ? (
            <Box
              sx={{
                position: "absolute",
                left: 7,
                right: 7,
                bottom: 7,
                zIndex: 1,
                display: "flex",
                // Wraps instead of overlapping whenever both chips don't fit side by side
                // (longer translations, small cards): the right-hand chip drops onto its own
                // line.
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "3px 4px",
                pointerEvents: "none",
                [SMALL_CARD]: { left: 6, right: 6, bottom: 6 },
              }}
            >
              {showSaleChip ? coverChip(t("games.card.onSaleLabel"), "#2f9e6c") : null}
              {showMissingChip || showCustomChip ? (
                <Box component="span" sx={{ ml: "auto", maxWidth: "100%", display: "flex" }}>
                  {showMissingChip
                    ? coverChip(t("games.card.missingLabel"), "primary.dark")
                    : coverChip(t("games.card.customLabel"), "#5d6673")}
                </Box>
              ) : null}
            </Box>
          ) : null}

          {hoverActions && !selectable ? (
            <Box
              className="vgt-card-actions"
              onClick={(event) => event.stopPropagation()}
              sx={{
                position: "absolute",
                left: 7,
                right: 7,
                top: 44,
                zIndex: 2,
                display: "flex",
                gap: 0.75,
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 150ms ease",
                // Touch screens have no hover; the card itself opens the game page, where
                // the same actions are.
                "@media (hover: none)": { display: "none" },
                [SMALL_CARD]: { top: 36, "& .vgt-card-action-label": { display: "none" } },
              }}
            >
              {hoverActions}
            </Box>
          ) : null}
        </Box>
      </Tooltip>

      <Box sx={{ pt: 1 }}>
        <Box
          sx={{
            fontWeight: 600,
            fontSize: 13.5,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            [SMALL_CARD]: { fontSize: 12.5 },
          }}
        >
          {game.name}
        </Box>
        {/* Year and add-on type on one line, so every card's text block is the same height
            and a row of mixed categories lines up. */}
        <Box
          sx={{
            color: "vgt.text3",
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minHeight: 17,
          }}
        >
          <span>{releaseYear ?? t("games.card.unknownYear")}</span>
          {isAddon(game) ? (
            <>
              <span aria-hidden> · </span>
              <span>{getAddonType(game)}</span>
            </>
          ) : null}
        </Box>
        {context === "list" || context === "addon" || context === "public" ? (
          // Always reserves the chip's slot (just invisible when there's no play status, and
          // while selecting), so a "Completed" chip on only some cards can't break a row's
          // alignment and entering selection mode doesn't shift the grid.
          <Chip
            label={playStatus ? t(PLAY_STATUS_LABEL_KEYS[playStatus]) : " "}
            color={playStatus ? PLAY_STATUS_COLORS[playStatus] : "default"}
            size="small"
            sx={{
              mt: 0.75,
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              visibility: showsBadges && playStatus ? "visible" : "hidden",
            }}
          />
        ) : null}
        {/* The "Add" button is hidden while a checkbox is showing (bulk-select mode on
            AddGame.tsx) — clicking the card there should toggle selection, not immediately
            import it, and a full-width Add button sitting right below the checkbox invited
            exactly that mistake. "Added" stays visible regardless: an already-added result
            never gets a checkbox (see AddGame.tsx's `selectable` prop), so there's no
            competing action to hide it from. */}
        {context === "added" || (context === "add" && !selectable) ? (
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
                {t("games.card.addedButton")}
              </AddedGameButton>
            ) : (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1.25 }}
                startIcon={actionIcon ?? <AddIcon />}
                onClick={contextFunction}
              >
                {actionLabel ?? t("common.add")}
              </Button>
            )}
          </>
        ) : null}
      </Box>
    </Box>
  );
};

export default GameCard;

interface GameCardHoverActionProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

// One of a card's hover shortcuts (see GameCard's hoverActions): dark glass so it reads on
// any cover, the accent on hover, icon-only on small cards.
export const GameCardHoverAction = ({ icon, label, onClick }: GameCardHoverActionProps) => (
  <Box
    component="button"
    type="button"
    aria-label={label}
    onClick={onClick}
    sx={{
      flex: 1,
      minWidth: 0,
      height: 30,
      border: 0,
      borderRadius: 1.5,
      bgcolor: "rgba(10, 12, 16, 0.84)",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 0.625,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "inherit",
      "& svg": { fontSize: 17 },
      "&:hover, &:focus-visible": { bgcolor: "primary.main", color: "primary.contrastText" },
    }}
  >
    {icon}
    <span className="vgt-card-action-label">{label}</span>
  </Box>
);
