import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { useAddons, useGame } from "../hooks/useGames";
import { useLibraryItems } from "../hooks/useLibrary";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../hooks/useNotes";
import { usePlatforms } from "../hooks/usePlatforms";
import { useRegions } from "../hooks/useRegions";
import { useAttachTag, useDetachTag } from "../hooks/useTags";
import { gameIdentifier } from "../utils/identifiers";
import { useCanonicalAddress, useDetailBack } from "../utils/navState";
import { DetailColumns, Panel, Section, Strip } from "./Detail";
import GameActionButtons from "./GameActionButtons";
import GameCard from "./GameCard";
import { ADDON_DISPLAY_CATEGORIES, GameAboutBlock, GameHero, GameMediaSections } from "./GameDetailParts";
import GameLibrarySection from "./GameLibrarySection";
import GameProgressSection from "./GameProgressSection";
import NotesSection from "./NotesSection";
import NotFoundPage from "./NotFoundPage";
import TagsSection from "./TagsSection";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";



const GameDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { identifier } = useParams<{ identifier: string }>();

  const { data: game, isError } = useGame(identifier);
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

  const routeCrumbs = useRouteCrumbs();
  const { back, toList } = useDetailBack("/games");
  // A rename (custom games) changes the address; correct it in place.
  useCanonicalAddress(game ? `/${location.pathname.startsWith("/addon/") ? "addon" : "game"}/${gameIdentifier(game)}` : null);

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

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.gameNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.games") })}
        actionTo="/games"
      />
    );
  }

  if (!game) {
    return <Page>{t("common.loading")}</Page>;
  }

  // Whether removal/the Addons section make sense here is about the *relationship* (does
  // this game have a parent?), not the category label — a manually-added game can be
  // categorized as a DLC/addon (cosmetic) while still being a standalone, top-level record
  // with no parent to cascade-delete it, so it still needs its own Remove Game action.
  const hasParentGame = game.parentGameId !== null;
  // Resyncing a game also re-fetches all of its addons from IGDB, so an addon resyncs via
  // its parent's id rather than its own — see GameActionButtons' resyncGameId prop.
  const resyncGameId = hasParentGame ? (game.parentGameId as number) : gameId;
  // Only exists locally because a Collection/Series "what's missing" resync discovered it —
  // see GameActionButtons.tsx and api/types.ts's GameDetail.autoDiscovered for what this
  // gates: no Resync/Remove (nothing to resync/remove from a library that was never asked
  // for) and no Tags/Your Library/Progress/Notes (nothing to tag, own, or track yet).
  const isAutoDiscovered = game.autoDiscovered;

  const handleAddonClick = (addon: GameSummary) => {
    navigate(`/addon/${gameIdentifier(addon)}`);
  };

  // Short platform names of the user's own copies, for the hero's pills.
  const copyPlatforms = Array.from(
    new Set(
      (libraryItems ?? [])
        .map(
          (item) =>
            platforms?.find((platform) => platform.id === item.platformId)?.abbreviation ?? item.platformName
        )
        .filter((name): name is string => Boolean(name))
    )
  ).sort();
  const displayedAddons = (addons ?? []).filter((addon) => ADDON_DISPLAY_CATEGORIES.has(addon.category));

  return (
    <Page
      crumbs={[]}
      toolbar={
        <>
          <ToolbarButton icon={<ArrowBackIcon />} label={toList ? t("nav.games") : t("detail.back")} onClick={back} />
          <ToolbarDivider />
          <GameActionButtons
            gameId={gameId}
            gameIdentifier={identifier!}
            gameName={game.name}
            gameCategory={game.category}
            hasParentGame={hasParentGame}
            hasIgdbId={game.igdbId !== null}
            resyncGameId={resyncGameId}
            isAutoDiscovered={isAutoDiscovered}
            libraryItems={libraryItems}
            onGameRemoved={() => navigate("/games", { replace: true })}
          />
        </>
      }
      hero={
        <GameHero
          game={game}
          status={{
            coverUrl: game.coverUrl,
            owned: game.owned,
            wishlisted: game.wishlisted,
            playStatus: game.playStatus,
            isOnSale: game.isOnSale,
            autoDiscovered: game.autoDiscovered,
            copyPlatforms,
          }}
          crumbs={routeCrumbs.slice(0, -1)}
        />
      }
    >
      <DetailColumns
        main={
          <>
            <GameAboutBlock game={game} />
            <GameMediaSections game={game} />
            {!hasParentGame ? (
              <Section id="addons" title={t("games.addons.title")}>
                {displayedAddons.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("games.addons.empty")}
                  </Typography>
                ) : (
                  <Strip>
                    {displayedAddons.map((addon) => (
                      <GameCard key={addon.id} game={addon} context="addon" contextFunction={() => handleAddonClick(addon)} />
                    ))}
                  </Strip>
                )}
              </Section>
            ) : null}
          </>
        }
        side={
          !isAutoDiscovered ? (
            <>
              <Section id="library" title={t("games.library.title")}>
                <Panel>
                  <GameLibrarySection
                    gameId={gameId}
                    libraryItems={libraryItems}
                    platforms={platforms}
                    regions={regions}
                    gameCategory={game.category}
                    inSection
                  />
                </Panel>
              </Section>
              {!hasParentGame ? (
                <Section id="progress" title={t("progress.title")}>
                  <Panel>
                    <GameProgressSection gameId={gameId} libraryItems={libraryItems} platforms={platforms} inSection />
                  </Panel>
                </Section>
              ) : null}
              <Section id="tags" title={t("tags.title")}>
                <Panel>
                  <TagsSection
                    tags={game.tags}
                    onAttach={(tagId) => attachTag.mutateAsync(tagId)}
                    onDetach={(tagId) => detachTag.mutateAsync(tagId)}
                    inSection
                  />
                </Panel>
              </Section>
              <Section id="notes" title={t("notes.title")}>
                <Panel>
                  <NotesSection
                    notes={notes}
                    isCreating={createNote.isPending}
                    onCreate={(body) => createNote.mutateAsync(body)}
                    onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
                    onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
                    inSection
                  />
                </Panel>
              </Section>
            </>
          ) : null
        }
      />
    </Page>
  );
};

export default GameDetails;
