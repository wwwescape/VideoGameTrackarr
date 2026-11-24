import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { usePackContents, usePacks, useWorksWith } from "../hooks/useAddonLinks";
import { useAddons, useGame } from "../hooks/useGames";
import { useEnabledLabs } from "../hooks/useLabs";
import { useScreensaverShows } from "../hooks/useScreensaver";
import { useLibraryItems } from "../hooks/useLibrary";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../hooks/useNotes";
import { usePlatforms } from "../hooks/usePlatforms";
import { useRegions } from "../hooks/useRegions";
import { useAttachTag, useDetachTag } from "../hooks/useTags";
import { useToysToLifeGameSection } from "../hooks/useToysToLife";
import { gameIdentifier } from "../utils/identifiers";
import { useCanonicalAddress, useDetailBack } from "../utils/navState";
import { canBeInScreensaver } from "../utils/screensaver";
import BaseGameAddonsHint from "./BaseGameAddonsHint";
import { DetailColumns, Section } from "./Detail";
import GameActionButtons from "./GameActionButtons";
import GameCard from "./GameCard";
import { ADDON_DISPLAY_CATEGORIES, GameAboutBlock, GameHero, GameMediaSections } from "./GameDetailParts";
import GameLibrarySection from "./GameLibrarySection";
import GameProgressSection from "./GameProgressSection";
import LinkedAddonsSection from "./LinkedAddonsSection";
import PackLinksSection from "./PackLinksSection";
import GuidesCheatsSection from "./GuidesCheatsSection";
import NotesSection from "./NotesSection";
import NotFoundPage from "./NotFoundPage";
import TagsSection from "./TagsSection";
import ScreensaverToggle from "./ScreensaverToggle";
import ToysToLifeSection from "./ToysToLifeSection";
import YourRatingSection from "./YourRatingSection";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";



// Wraps like the Screenshots and Videos grids: two columns on phones, then as many cards as fit.
const ADDON_GRID_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fill, minmax(150px, 1fr))" },
  gap: "18px 14px",
};

const GameDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { identifier } = useParams<{ identifier: string }>();

  const { data: game, isError } = useGame(identifier);
  const gameId = game?.id ?? NaN;
  const { data: addons } = useAddons(gameId);
  // Linked Add-ons lab: manual add-on links, the Works with section and the base-game hint.
  const linkedAddonsLab = useEnabledLabs().has("linked_addons");
  // An add-on's own games (IGDB parent, then manual links); a game's add-ons come from useAddons.
  const isAddon = game ? ADDON_DISPLAY_CATEGORIES.has(game.category) : false;
  const { data: worksWith } = useWorksWith(gameId, linkedAddonsLab && isAddon);
  // Packs (Season Pass, Ultimate Pack): what's inside one, and the packs an add-on is in.
  const { data: packContents } = usePackContents(gameId, linkedAddonsLab && isAddon);
  // A Pack that can hold add-ons: a custom one, or one already holding some. IGDB files many
  // single add-ons as Packs (every The Sims 4 stuff pack); those are ordinary add-ons here, like
  // addon_link_service.is_pack on the server.
  const isPack =
    game?.category === "pack" && (game.igdbId === null || (packContents ?? []).length > 0);
  const { data: packs } = usePacks(gameId, linkedAddonsLab && isAddon);
  // The link picker below Notes; the Add-ons hint opens it too.
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  // Set only on a Toys-to-Life line's base game (LEGO Dimensions), which shows its packs instead of Addons.
  const { data: toysToLife } = useToysToLifeGameSection(gameId);
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
  const screensaverLab = useEnabledLabs().has("screensaver");
  const { shows: screensaverShows } = useScreensaverShows();
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
  const handleWorksWithClick = (other: GameSummary) => {
    navigate(`/game/${gameIdentifier(other)}`);
  };
  // The manual links alone: the base-game hint only shows while there are none.
  const manualLinks = (isAddon ? worksWith : addons)?.filter((other) => other.manualLink);
  // Below Notes on a game: all its add-ons, IGDB's too (not unlinkable, but any relation can be
  // set), except ones only there because they sit inside a pack Included in the game.
  const gameLinks = addons?.filter(
    (other) => ADDON_DISPLAY_CATEGORIES.has(other.category) && (other.manualLink || !other.includedVia)
  );
  // An IGDB game (not an add-on) can take add-ons from its base game, e.g. FH5 Premium.
  const offerBaseGameAddons = linkedAddonsLab && !isAddon && game.igdbId !== null && !isAutoDiscovered;
  // With the lab on, every add-on shows Works with instead of Add-ons; with it off, as before.
  const showWorksWith = linkedAddonsLab && isAddon;

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
            linkedFromCustom={game.linkedFromCustom}
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
          corner={
            screensaverLab && canBeInScreensaver(game, screensaverShows) ? (
              <ScreensaverToggle gameId={game.id} excluded={game.screensaverExcluded} />
            ) : undefined
          }
        />
      }
    >
      <DetailColumns
        main={
          <>
            <GameAboutBlock game={game} />
            <GameMediaSections game={game} />
            {!hasParentGame && toysToLife ? <ToysToLifeSection section={toysToLife} /> : null}
            {showWorksWith ? (
              // Where a game shows its Add-ons: the games this add-on belongs with.
              <Section id="works-with" title={t("games.addonLinks.worksWithTitle")}>
                {(worksWith ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("games.addonLinks.worksWithEmpty")}
                  </Typography>
                ) : (
                  <Box sx={ADDON_GRID_SX}>
                    {(worksWith ?? []).map((other) => (
                      <GameCard
                        key={other.id}
                        game={other}
                        context="addon"
                        contextFunction={() => handleWorksWithClick(other)}
                      />
                    ))}
                  </Box>
                )}
              </Section>
            ) : null}
            {showWorksWith && isPack ? (
              // A pack's contents: Included, so owning the pack owns them.
              <Section id="pack-contents" title={t("games.packs.contentsTitle")}>
                {(packContents ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("games.packs.contentsEmpty")}
                  </Typography>
                ) : (
                  <Box sx={ADDON_GRID_SX}>
                    {(packContents ?? []).map((addon) => (
                      <GameCard
                        key={addon.id}
                        game={addon}
                        context="addon"
                        contextFunction={() => handleAddonClick(addon)}
                        includedTooltip={t("games.card.includedInPackTooltip")}
                      />
                    ))}
                  </Box>
                )}
              </Section>
            ) : null}
            {showWorksWith && (packs ?? []).length > 0 ? (
              <Section id="part-of" title={t("games.packs.partOfTitle")}>
                <Box sx={ADDON_GRID_SX}>
                  {(packs ?? []).map((pack) => (
                    <GameCard
                      key={pack.id}
                      game={{ ...pack, included: false }}
                      context="addon"
                      contextFunction={() => handleAddonClick(pack)}
                    />
                  ))}
                </Box>
              </Section>
            ) : null}
            {!showWorksWith && !hasParentGame && !toysToLife ? (
              <Section id="addons" title={t("games.addons.title")}>
                <BaseGameAddonsHint
                  key={gameId}
                  gameId={gameId}
                  enabled={offerBaseGameAddons && manualLinks !== undefined && manualLinks.length === 0}
                  onOpenPicker={() => setLinkPickerOpen(true)}
                />
                {displayedAddons.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("games.addons.empty")}
                  </Typography>
                ) : (
                  <Box sx={ADDON_GRID_SX}>
                    {displayedAddons.map((addon) => (
                      <GameCard key={addon.id} game={addon} context="addon" contextFunction={() => handleAddonClick(addon)} />
                    ))}
                  </Box>
                )}
              </Section>
            ) : null}
          </>
        }
        side={
          !isAutoDiscovered ? (
            <>
              <YourRatingSection gameId={gameId} rating={game.rating} />
              <GameLibrarySection
                gameId={gameId}
                gameName={game.name}
                libraryItems={libraryItems}
                platforms={platforms}
                regions={regions}
                gameCategory={game.category}
                ownedVia={game.ownedVia}
                wishlistedVia={game.wishlistedVia}
              />
              {!hasParentGame ? (
                <GameProgressSection
                  gameId={gameId}
                  libraryItems={libraryItems}
                  platforms={platforms}
                  playStatus={game.playStatus}
                />
              ) : null}
              <TagsSection
                tags={game.tags}
                onAttach={(tagId) => attachTag.mutateAsync(tagId)}
                onDetach={(tagId) => detachTag.mutateAsync(tagId)}
              />
              <GuidesCheatsSection gameId={gameId} libraryItems={libraryItems} gamePlatforms={game.platforms} />
              <NotesSection
                notes={notes}
                isCreating={createNote.isPending}
                onCreate={(body) => createNote.mutateAsync(body)}
                onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
                onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
              />
              {linkedAddonsLab ? (
              <LinkedAddonsSection
                gameId={gameId}
                gameName={game.name}
                isAddon={isAddon}
                // On an add-on: its IGDB parent too, which can be marked Included there.
                links={isAddon ? worksWith : gameLinks}
                onCurrentGameDeleted={() => navigate("/games", { replace: true })}
                offerBaseGameAddons={offerBaseGameAddons}
                pickerOpen={linkPickerOpen}
                onPickerOpenChange={setLinkPickerOpen}
              />
              ) : null}
              {linkedAddonsLab && isAddon ? (
                <PackLinksSection
                  gameId={gameId}
                  gameName={game.name}
                  isPack={isPack}
                  items={isPack ? packContents : packs}
                  onCurrentGameDeleted={() => navigate("/games", { replace: true })}
                />
              ) : null}
            </>
          ) : null
        }
      />
    </Page>
  );
};

export default GameDetails;
