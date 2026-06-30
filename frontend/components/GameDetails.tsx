import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import type { GameSummary } from "../api/types";
import { useAddons, useGame } from "../hooks/useGames";
import { useLibraryItems } from "../hooks/useLibrary";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../hooks/useNotes";
import { usePlatforms } from "../hooks/usePlatforms";
import { useRegions } from "../hooks/useRegions";
import { useAttachTag, useDetachTag } from "../hooks/useTags";
import { gameIdentifier } from "../utils/identifiers";
import GameAboutSection from "./GameAboutSection";
import GameActionButtons from "./GameActionButtons";
import GameAddonsSection from "./GameAddonsSection";
import GameCoverCard from "./GameCoverCard";
import GameLibrarySection from "./GameLibrarySection";
import NotesSection from "./NotesSection";
import PlaySessionsSection from "./PlaySessionsSection";
import ProgressStatusCard from "./ProgressStatusCard";
import TagsSection from "./TagsSection";

// Total fixed chrome stacked above the scrollable content: AppShell.tsx's AppBar (56px
// compact / 64px at sm+) plus Breadcrumbs.tsx's separately-fixed bar (its own 40px,
// positioned at top: appBarHeight) — 96/104px — plus an 8px buffer so a scrolled-to
// section's header isn't flush against the breadcrumb bar.
const SECTION_SCROLL_MARGIN_TOP = { xs: 104, sm: 112 };

const sectionCardSx = { borderRadius: 2, overflow: "hidden", scrollMarginTop: SECTION_SCROLL_MARGIN_TOP } as const;

const GameDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { identifier } = useParams<{ identifier: string }>();

  const { data: game } = useGame(identifier);
  const gameId = game?.id ?? NaN;
  const { data: addons } = useAddons(gameId);
  const { data: libraryItems } = useLibraryItems(gameId);
  const { data: platforms } = usePlatforms();
  const { data: regions } = useRegions();
  const attachTag = useAttachTag(gameId);
  const detachTag = useDetachTag(gameId);
  const { data: notes } = useNotes(gameId);
  const createNote = useCreateNote(gameId);
  const updateNote = useUpdateNote(gameId);
  const deleteNote = useDeleteNote(gameId);

  // Replaces the old tab-based deep links (e.g. jumping straight to the Actions tab) —
  // deferred to the next paint via requestAnimationFrame so the layout above the target
  // section (which depends on `game` having loaded) has settled first.
  useEffect(() => {
    if (!location.hash || !game) return;
    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, game]);

  if (!game) {
    return <>Loading...</>;
  }

  // Whether removal/the Addons section make sense here is about the *relationship* (does
  // this game have a parent?), not the category label — a manually-added game can be
  // categorized as a DLC/addon (cosmetic) while still being a standalone, top-level record
  // with no parent to cascade-delete it, so it still needs its own Remove Game action.
  const hasParentGame = game.parentGameId !== null;
  // Resyncing a game also re-fetches all of its addons from IGDB, so an addon resyncs via
  // its parent's id rather than its own — see GameActionButtons' resyncGameId prop.
  const resyncGameId = hasParentGame ? (game.parentGameId as number) : gameId;

  const handleAddonClick = (addon: GameSummary) => {
    navigate(`/addon/${gameIdentifier(addon)}`);
  };

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          <GameCoverCard game={game} />
          <GameActionButtons
            gameId={gameId}
            gameIdentifier={identifier!}
            gameName={game.name}
            gameCategory={game.category}
            hasParentGame={hasParentGame}
            hasIgdbId={game.igdbId !== null}
            resyncGameId={resyncGameId}
            onGameRemoved={() => navigate("/")}
          />
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <Stack spacing={3}>
          <Card id="about" sx={sectionCardSx}>
            <GameAboutSection game={game} />
          </Card>
          {!hasParentGame ? (
            <Card id="progress" sx={sectionCardSx}>
              <ProgressStatusCard gameId={game.id} progress={game.progress} />
            </Card>
          ) : null}
          <Card id="tags" sx={sectionCardSx}>
            <TagsSection
              tags={game.tags}
              onAttach={(tagId) => attachTag.mutateAsync(tagId)}
              onDetach={(tagId) => detachTag.mutateAsync(tagId)}
            />
          </Card>
          {!hasParentGame ? (
            <Card id="play-sessions" sx={sectionCardSx}>
              <PlaySessionsSection gameId={game.id} />
            </Card>
          ) : null}
          <Card id="notes" sx={sectionCardSx}>
            <NotesSection
              notes={notes}
              isCreating={createNote.isPending}
              onCreate={(body) => createNote.mutateAsync(body)}
              onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
              onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
            />
          </Card>
          <Card id="library" sx={sectionCardSx}>
            <GameLibrarySection
              gameId={gameId}
              libraryItems={libraryItems}
              platforms={platforms}
              regions={regions}
            />
          </Card>
          {!hasParentGame ? (
            <Card id="addons" sx={sectionCardSx}>
              <GameAddonsSection addons={addons} onAddonClick={handleAddonClick} />
            </Card>
          ) : null}
        </Stack>
      </Grid>
    </Grid>
  );
};

export default GameDetails;
