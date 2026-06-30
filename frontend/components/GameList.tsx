import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { GameSummary } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDeleteGame, useGames } from "../hooks/useGames";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { showUndoToast } from "./UndoToast";
import GameCard from "./GameCard";
import GameListToolbar, { type GameFilter } from "./GameListToolbar";
import GamesSubNav from "./GamesSubNav";
import VirtualGameGrid from "./VirtualGameGrid";

const MIN_SEARCH_LENGTH = 4;

const GameList = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filter, setFilter] = useState<GameFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const isPendingDebounce = trimmedKeyword.length >= MIN_SEARCH_LENGTH && trimmedKeyword !== debouncedKeyword;

  const { data: games, isLoading, isFetching } = useGames(isSearchActive ? debouncedKeyword : undefined);
  const isSearching = isPendingDebounce || (isSearchActive && isFetching);

  const deleteGameMutation = useDeleteGame();
  const { schedule, isPending, delayMs } = useUndoableAction<GameSummary>({
    getId: (game) => game.id,
    onCommit: async (gamesToRemove) => {
      await Promise.all(gamesToRemove.map((game) => deleteGameMutation.mutateAsync(game.id)));
    },
  });

  const filteredGames = useMemo(() => {
    if (!games) return [];
    if (filter === "owned") return games.filter((game) => game.owned);
    if (filter === "wishlist") return games.filter((game) => game.wishlisted);
    return games;
  }, [games, filter]);

  const visibleGames = useMemo(
    () => filteredGames.filter((game) => !isPending(game.id)),
    [filteredGames, isPending]
  );

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const toggleSelected = (gameId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(visibleGames.map((game) => game.id)));
  };

  const handleCompare = () => {
    const ids = visibleGames.filter((game) => selectedIds.has(game.id)).map((game) => game.uuid);
    if (ids.length < 2) {
      return;
    }
    navigate(`/compare?ids=${ids.join(",")}`);
  };

  const handleBulkDelete = () => {
    const itemsToRemove = visibleGames.filter((game) => selectedIds.has(game.id));
    if (itemsToRemove.length === 0) {
      return;
    }
    const { undo } = schedule(itemsToRemove);
    setSelectionMode(false);
    setSelectedIds(new Set());
    showUndoToast(
      `${itemsToRemove.length} game${itemsToRemove.length > 1 ? "s" : ""} removed from your library`,
      undo,
      delayMs
    );
  };

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: (theme) => theme.mixins.toolbar.minHeight,
          zIndex: 1,
          bgcolor: "background.default",
          pb: 2.5,
          // Once scrolled content locks under this sticky header, the bottom edge needs to
          // read as an intentional floating panel rather than content abruptly disappearing.
          boxShadow: "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <GamesSubNav />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Games
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Search and browse your collection, wishlist, and tracked addons.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/games/add")}
            sx={{ flexShrink: 0 }}
          >
            Add Game
          </Button>
        </Box>
        <GameListToolbar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          filter={filter}
          onFilterChange={setFilter}
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          visibleCount={visibleGames.length}
          onEnterSelectionMode={handleEnterSelectionMode}
          onExitSelectionMode={handleExitSelectionMode}
          onSelectAllVisible={handleSelectAllVisible}
          onBulkDelete={handleBulkDelete}
          onCompare={handleCompare}
        />
      </Box>
      {/* Contains z-index in here to its own stacking context — otherwise MUI's
          shrunk-label z-index (1, same as the sticky header above) ties with the sticky
          box's and falls back to DOM order, letting a floating label paint on top of the
          sticky header instead of staying hidden behind it. */}
      <Box sx={{ isolation: "isolate" }}>
        {isLoading ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>
        ) : isSearching ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>Searching...</Paper>
        ) : visibleGames.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            {isSearchActive
              ? "No games found"
              : filter !== "all"
                ? "No games match this filter"
                : "Please add some games"}
          </Paper>
        ) : (
          <VirtualGameGrid
            items={visibleGames}
            getKey={(game) => game.id}
            renderItem={(game) => (
              <GameCard
                game={game}
                context="list"
                contextFunction={() => handleGameClick(game)}
                selectable={selectionMode}
                selected={selectedIds.has(game.id)}
                onToggleSelect={() => toggleSelected(game.id)}
              />
            )}
          />
        )}
      </Box>
    </>
  );
};

export default GameList;
