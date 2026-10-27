import { useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { GameSortOption, GameSummary, PlayStatus } from "../api/types";
import { gameSortDirection, gameSortField, nextGameSort, type GameSortField } from "../utils/gameSortOptions";
import { getAddonType, getReleaseYear } from "../utils/utils";
import { GAME_TYPE_OPTIONS } from "./GameFilterDialog";
import { SortHeaderCell } from "./ListControls";
import { STICKY_TOP } from "./Page";
import VirtualGameGrid, { type VirtualGridHandle } from "./VirtualGameGrid";

export type GameListView = "covers" | "table" | "overview";

export const CARD_SIZE_MIN = 140;
export const CARD_SIZE_MAX = 300;
export const CARD_SIZE_DEFAULT = 170;

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Space between the A–Z rail and the sticky toolbar above it, and the window's bottom edge.
const RAIL_GAP = 14;

const letterOf = (name: string) => {
  const first = name.trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
};

const PLAY_STATUS_COLORS: Record<PlayStatus, "default" | "info" | "success" | "error"> = {
  none: "default",
  backlog: "default",
  playing: "info",
  completed: "success",
  abandoned: "error",
};

// "Main Game", "Remaster", "DLC"… — the filter's game-type labels, then the add-on labels.
export function categoryLabel(game: Pick<GameSummary, "category">): string {
  return (
    GAME_TYPE_OPTIONS.find((option) => option.value === game.category)?.label ?? getAddonType(game) ?? ""
  );
}

interface CoverGridProps {
  games: GameSummary[];
  cardSize: number;
  // The A–Z rail only makes sense while the list is sorted by name, A first.
  showRail: boolean;
  renderCard: (game: GameSummary) => ReactNode;
}

// Covers view: the windowed grid sized by the Options card size, with an A–Z jump rail down
// the right-hand side on desktop.
export function GameCoverGrid({ games, cardSize, showRail, renderCard }: CoverGridProps) {
  const { t } = useTranslation();
  const gridRef = useRef<VirtualGridHandle>(null);
  const railRef = useRef<HTMLElement>(null);

  // The rail fills the window from where it sits down to just above the bottom edge: lower at
  // the top of the page (below the breadcrumbs), then stuck under the toolbar once scrolled.
  // Measured from no higher than its sticky spot: at the end of the list the grid pushes the
  // rail up past that spot, and measuring from there made it taller, which made the page
  // taller, which let it scroll further and push the rail up again — without end.
  const fitRail = () => {
    const rail = railRef.current;
    if (!rail) return;
    const top = Math.max(rail.getBoundingClientRect().top, STICKY_TOP.sm + RAIL_GAP);
    rail.style.height = `${window.innerHeight - top - RAIL_GAP}px`;
  };
  // Every render too, since chips or a notice above the grid can move it.
  useLayoutEffect(fitRail);
  useEffect(() => {
    window.addEventListener("scroll", fitRail, { passive: true });
    window.addEventListener("resize", fitRail);
    return () => {
      window.removeEventListener("scroll", fitRail);
      window.removeEventListener("resize", fitRail);
    };
  }, []);
  const firstIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!showRail) return map;
    games.forEach((game, index) => {
      const letter = letterOf(game.name);
      if (!map.has(letter)) map.set(letter, index);
    });
    return map;
  }, [games, showRail]);

  return (
    <Box sx={{ display: "flex", gap: 1.25 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
          renderItem={renderCard}
          minItemWidth={cardSize}
          scrollPaddingStart={STICKY_TOP.sm + 12}
          handleRef={gridRef}
        />
      </Box>
      {showRail ? (
        <Box
          component="nav"
          ref={railRef}
          aria-label={t("games.listView.jumpTo")}
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            position: "sticky",
            top: STICKY_TOP.sm + RAIL_GAP,
            alignSelf: "flex-start",
            width: 22,
            flexShrink: 0,
            // Letters spread evenly down the height fitRail sets; on a short window it keeps a
            // readable minimum instead of squashing them together.
            minHeight: LETTERS.length * 15,
          }}
        >
          {LETTERS.map((letter) => {
            const index = firstIndex.get(letter);
            return (
              <ButtonBase
                key={letter}
                disabled={index === undefined}
                onClick={() => index !== undefined && gridRef.current?.scrollToIndex(index)}
                aria-label={t("games.listView.jumpToLetter", { letter })}
                sx={{
                  flex: "1 1 0",
                  minHeight: 0,
                  width: "100%",
                  fontSize: 11,
                  fontWeight: 600,
                  px: 0.5,
                  borderRadius: 1,
                  color: "vgt.text3",
                  "&.Mui-disabled": { opacity: 0.35 },
                  "&:hover": { color: "primary.main", bgcolor: "vgt.accentSoft" },
                }}
              >
                {letter}
              </ButtonBase>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

interface RowsProps {
  games: GameSummary[];
  onOpen: (game: GameSummary) => void;
  selecting: boolean;
  selectedIds: ReadonlySet<number>;
  onToggleSelect: (gameId: number) => void;
}

// A row opens its game (or toggles it while selecting) on click, Enter or Space, like a card.
function rowHandlers(game: GameSummary, { onOpen, selecting, onToggleSelect }: RowsProps) {
  const activate = () => (selecting ? onToggleSelect(game.id) : onOpen(game));
  return {
    onClick: activate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    },
    tabIndex: 0,
  };
}

const Cover = ({ game, width }: { game: GameSummary; width: number }) => (
  <Box
    sx={{
      width,
      aspectRatio: "3 / 4",
      borderRadius: 1,
      overflow: "hidden",
      bgcolor: "vgt.surface2",
      flexShrink: 0,
    }}
  >
    {game.coverUrl ? (
      <Box
        component="img"
        src={resolveAssetUrl(game.coverUrl) ?? undefined}
        alt=""
        loading="lazy"
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          filter: !game.owned && !game.wishlisted ? "grayscale(1)" : "none",
        }}
      />
    ) : null}
  </Box>
);

const OwnershipIcons = ({ game }: { game: GameSummary }) => {
  const { t } = useTranslation();
  return (
    <Box component="span" sx={{ display: "inline-flex", gap: 0.5, verticalAlign: "middle" }}>
      {game.owned ? (
        <CheckIcon aria-label={t("ownershipBadges.ownedTooltip")} sx={{ fontSize: 17, color: "vgt.owned" }} />
      ) : null}
      {game.wishlisted ? (
        <FavoriteIcon aria-label={t("ownershipBadges.wishlistTooltip")} sx={{ fontSize: 16, color: "vgt.wishlist" }} />
      ) : null}
    </Box>
  );
};

// The card's chips (On sale, Missing, Custom) as small inline chips.
const StateChips = ({ game }: { game: GameSummary }) => {
  const { t } = useTranslation();
  const missing = game.autoDiscovered && !game.owned && !game.wishlisted;
  return (
    <>
      {game.isOnSale ? <Chip size="small" color="success" label={t("games.card.onSaleLabel")} /> : null}
      {missing ? <Chip size="small" color="primary" label={t("games.card.missingLabel")} /> : null}
      {game.igdbId === null && !missing ? <Chip size="small" label={t("games.card.customLabel")} /> : null}
    </>
  );
};

const PlayStatusChip = ({ status }: { status: PlayStatus | null }) => {
  const { t } = useTranslation();
  if (!status || status === "none") return null;
  return (
    <Chip
      size="small"
      color={PLAY_STATUS_COLORS[status]}
      label={t(`games.card.playStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
    />
  );
};

const SelectBox = ({ game, selectedIds, onToggleSelect }: Pick<RowsProps, "selectedIds" | "onToggleSelect"> & { game: GameSummary }) => {
  const { t } = useTranslation();
  const selected = selectedIds.has(game.id);
  return (
    <Checkbox
      size="small"
      checked={selected}
      onClick={(event) => {
        event.stopPropagation();
        onToggleSelect(game.id);
      }}
      slotProps={{
        input: {
          "aria-label": selected
            ? t("games.card.deselectAriaLabel", { name: game.name })
            : t("games.card.selectAriaLabel", { name: game.name }),
        },
      }}
    />
  );
};

interface GameTableProps extends RowsProps {
  // The list's sort, which a column header click changes (same setting as the Sort menu).
  sort: GameSortOption;
  onSortChange: (sort: GameSortOption) => void;
}

// Table view: one dense row per game, every field in its own column. Every column but the
// cover sorts the list when its header is clicked; clicking it again flips the direction.
export function GameTable(props: GameTableProps) {
  const { games, selecting, selectedIds, onToggleSelect, sort, onSortChange } = props;
  const { t } = useTranslation();
  const current = { field: gameSortField(sort), direction: gameSortDirection(sort) };
  const header = (field: GameSortField, label: ReactNode, sx?: object) => (
    <SortHeaderCell field={field} sort={current} onSort={(next) => onSortChange(nextGameSort(sort, next))} sx={sx}>
      {label}
    </SortHeaderCell>
  );
  return (
    <TableContainer
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        "& th, & td": { whiteSpace: "nowrap" },
      }}
    >
      <Table size="small" aria-label={t("nav.games")}>
        <TableHead>
          <TableRow>
            {selecting ? <TableCell padding="checkbox" /> : null}
            <TableCell sx={{ width: 46 }} />
            {header("name", t("games.listView.columnName"))}
            {header("library", t("games.listView.columnLibrary"))}
            {header("type", t("games.listView.columnType"), { display: { xs: "none", md: "table-cell" } })}
            {header("release_date", t("games.listView.columnYear"))}
            {header("platforms", t("games.listView.columnPlatforms"), { display: { xs: "none", sm: "table-cell" } })}
            {header("play_status", t("games.listToolbar.playStatusLabel"), { display: { xs: "none", md: "table-cell" } })}
            {header("rating", t("games.listView.columnRating"), { display: { xs: "none", lg: "table-cell" } })}
            {header("labels", t("games.listView.columnLabels"), { display: { xs: "none", md: "table-cell" } })}
          </TableRow>
        </TableHead>
        <TableBody>
          {games.map((game) => {
            const selected = selectedIds.has(game.id);
            return (
              <TableRow
                key={game.id}
                hover
                selected={selected}
                aria-label={game.name}
                {...rowHandlers(game, props)}
                sx={{ cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
              >
                {selecting ? (
                  <TableCell padding="checkbox">
                    <SelectBox game={game} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
                  </TableCell>
                ) : null}
                <TableCell sx={{ py: 0.5 }}>
                  <Cover game={game} width={30} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {game.name}
                </TableCell>
                <TableCell>
                  <OwnershipIcons game={game} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, color: "text.secondary" }}>{categoryLabel(game)}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{getReleaseYear(game.firstReleaseDate) ?? "—"}</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  {game.libraryPlatforms.length ? game.libraryPlatforms.join(", ") : "—"}
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <PlayStatusChip status={game.playStatus} />
                </TableCell>
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, color: "text.secondary" }}>
                  {game.rating != null ? t("progress.ratingValue", { rating: game.rating }) : "—"}
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, whiteSpace: "nowrap", "& .MuiChip-root + .MuiChip-root": { ml: 0.5 } }}>
                  <StateChips game={game} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Overview view: a bigger cover with the game's key facts beside it.
export function GameOverviewRows(props: RowsProps) {
  const { games, selecting, selectedIds, onToggleSelect } = props;
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {games.map((game) => {
        const selected = selectedIds.has(game.id);
        const facts = [getReleaseYear(game.firstReleaseDate), categoryLabel(game), game.libraryPlatforms.join(", ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <Box
            key={game.id}
            role="button"
            aria-label={game.name}
            aria-pressed={selecting ? selected : undefined}
            {...rowHandlers(game, props)}
            sx={{
              display: "flex",
              gap: 1.75,
              alignItems: "flex-start",
              p: 1,
              borderRadius: 2,
              border: 1,
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: "background.paper",
              cursor: "pointer",
              "&:hover": { borderColor: selected ? "primary.main" : "vgt.borderStrong" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            {selecting ? <SelectBox game={game} selectedIds={selectedIds} onToggleSelect={onToggleSelect} /> : null}
            <Cover game={game} width={64} />
            <Box sx={{ minWidth: 0, flexGrow: 1, pt: 0.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600, fontSize: 15 }}>
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {game.name}
                </Box>
                <OwnershipIcons game={game} />
              </Box>
              <Box sx={{ color: "vgt.text3", fontSize: 12.5, mt: 0.25 }}>{facts}</Box>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
                <PlayStatusChip status={game.playStatus} />
                <StateChips game={game} />
                {game.rating != null ? <Chip size="small" variant="outlined" label={t("progress.ratingValue", { rating: game.rating })} /> : null}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
