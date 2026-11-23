import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isAxiosError } from "axios";
import AddLinkIcon from "@mui/icons-material/AddLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LAST_LINK_ORPHAN, relationOf } from "../api/addonLinks";
import type { AddonRelation } from "../api/addonLinks";
import type { GameSummary } from "../api/types";
import { useAddAddonLinks, useRemoveAddonLink, useSetAddonRelation } from "../hooks/useAddonLinks";
import { useDeleteGame } from "../hooks/useGames";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { LockedUnlinkButton, RelationButton, relationLabelKey } from "./AddonRelationControls";
import ConfirmDialog from "./ConfirmDialog";
import { Section, SectionAction } from "./Detail";
import LinkAddonsDialog from "./LinkAddonsDialog";
import { showUndoToast } from "./UndoToast";

interface LinkedAddonsSectionProps {
  gameId: number;
  gameName: string;
  // On an add-on this lists and links games; on a game it lists and links add-ons.
  isAddon: boolean;
  // Everything this side goes with: the manual links (manualLink) and IGDB's own (an add-on's
  // parent, a game's IGDB add-ons), which can't be unlinked but can take any relation.
  links: GameSummary[] | undefined;
  // Deleting this page's own add-on (offered when its last link can't be removed).
  onCurrentGameDeleted: () => void;
  // A game imported from IGDB: the picker also offers its base game's add-ons.
  offerBaseGameAddons?: boolean;
  // Optional control of the picker, so something else on the page (the Add-ons hint) can
  // open it; uncontrolled otherwise.
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

// Rows shown before "Show N more": long add-on lists (The Sims 4 has 115) stay short.
const COLLAPSED_ROWS = 5;

// Manual links first, then IGDB ones marked Included or as a pre-order bonus, then the rest;
// by name within each.
const rowRank = (link: GameSummary, relation: AddonRelation) =>
  link.manualLink ? 0 : relation === "works_with" ? 2 : 1;

// The relation ids for re-linking one row as it was (Undo).
const relationIdsFor = (id: number, relation: AddonRelation) => ({
  includedIds: relation === "included" ? [id] : [],
  preorderBonusIds: relation === "preorder_bonus" ? [id] : [],
});

// Below Notes on every game and add-on page: the manual "works with" links on this side, with
// Link opening the picker and × unlinking straight away (Undo puts it back). The relation button
// on each row shows how the add-on goes with that game and switches it between Works with,
// Included and Pre-order bonus. Removing an
// add-on's last link when it has no IGDB parent here is refused by the server, since it would
// then show up nowhere; that offers to delete the add-on instead.
const LinkedAddonsSection = ({
  gameId,
  gameName,
  isAddon,
  links,
  onCurrentGameDeleted,
  offerBaseGameAddons = false,
  pickerOpen: controlledPickerOpen,
  onPickerOpenChange,
}: LinkedAddonsSectionProps) => {
  const { t } = useTranslation();
  const [ownPickerOpen, setOwnPickerOpen] = useState(false);
  const pickerOpen = controlledPickerOpen ?? ownPickerOpen;
  const setPickerOpen = (open: boolean) => {
    setOwnPickerOpen(open);
    onPickerOpenChange?.(open);
  };
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(new Set());
  const [orphan, setOrphan] = useState<GameSummary | null>(null);
  // Relations just changed here, shown at once until the refetched list agrees.
  const [relationOverrides, setRelationOverrides] = useState<ReadonlyMap<number, AddonRelation>>(
    new Map()
  );
  const removeLink = useRemoveAddonLink(gameId);
  const addLinks = useAddAddonLinks(gameId);
  const setRelation = useSetAddonRelation(gameId);
  const deleteGame = useDeleteGame();

  const setHidden = (id: number, hidden: boolean) =>
    setHiddenIds((previous) => {
      const next = new Set(previous);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleUnlink = async (other: GameSummary) => {
    setHidden(other.id, true);
    try {
      await removeLink.mutateAsync(other.id);
      showUndoToast(
        t("games.addonLinks.unlinkedToast", { name: other.name }),
        () => {
          setHidden(other.id, false);
          addLinks
            .mutateAsync({ ids: [other.id], ...relationIdsFor(other.id, relationFor(other)) })
            .catch((error) => {
              console.error("Error restoring link:", error);
              toast.error(t("games.addonLinks.linkError"), TOAST_OPTIONS);
            });
        },
        5000
      );
    } catch (error) {
      // Saved: it stays hidden until the refreshed list drops it. Not saved: back it comes.
      setHidden(other.id, false);
      if (
        isAxiosError(error) &&
        error.response?.status === 409 &&
        error.response.data?.detail === LAST_LINK_ORPHAN
      ) {
        setOrphan(other);
      } else {
        console.error("Error unlinking:", error);
        toast.error(t("games.addonLinks.unlinkError"), TOAST_OPTIONS);
      }
    }
  };

  // A row's own relation to this game. On a game's list, an add-on inside an Included pack is
  // flagged Included (includedVia) without being Included itself.
  const relationFor = (other: GameSummary) =>
    relationOverrides.get(other.id) ??
    (other.includedVia
      ? other.preorderBonus
        ? "preorder_bonus"
        : "works_with"
      : relationOf(other));

  const handleRelation = async (other: GameSummary, relation: AddonRelation) => {
    setRelationOverrides((previous) => new Map(previous).set(other.id, relation));
    try {
      await setRelation.mutateAsync({ otherId: other.id, relation });
    } catch (error) {
      // Kept on success until the refreshed list agrees; dropped when it wasn't saved.
      setRelationOverrides((previous) => {
        const next = new Map(previous);
        next.delete(other.id);
        return next;
      });
      console.error("Error changing the relation:", error);
      toast.error(t("games.addonLinks.relationError"), TOAST_OPTIONS);
    }
  };

  // The add-on that would be left attached to nothing: this page's own, or the linked one.
  const orphanAddon = orphan
    ? isAddon
      ? { id: gameId, name: gameName }
      : { id: orphan.id, name: orphan.name }
    : null;

  const handleDeleteOrphan = async () => {
    if (!orphanAddon) return;
    try {
      await deleteGame.mutateAsync(orphanAddon.id);
      setOrphan(null);
      toast.success(
        t("games.addonLinks.addonDeletedToast", { name: orphanAddon.name }),
        TOAST_OPTIONS
      );
      if (orphanAddon.id === gameId) onCurrentGameDeleted();
    } catch (error) {
      console.error("Error deleting add-on:", error);
      toast.error(t("games.actions.removeErrorToast"), TOAST_OPTIONS);
    }
  };

  const [expanded, setExpanded] = useState(false);
  const visible = (links ?? [])
    .filter((link) => !hiddenIds.has(link.id))
    .sort(
      (a, b) =>
        rowRank(a, relationFor(a)) - rowRank(b, relationFor(b)) || a.name.localeCompare(b.name)
    );
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_ROWS);
  const moreCount = visible.length - COLLAPSED_ROWS;

  return (
    <Section
      id="linked-addons"
      title={t(
        isAddon ? "games.addonLinks.linkedGamesTitle" : "games.addonLinks.linkedAddonsTitle"
      )}
      action={
        <SectionAction
          icon={<AddLinkIcon />}
          label={t("games.addonLinks.linkAction")}
          onClick={() => setPickerOpen(true)}
        />
      }
    >
      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t(isAddon ? "games.addonLinks.emptyForAddon" : "games.addonLinks.emptyForGame")}
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}
        >
          {shown.map((link) => {
            const relation = relationFor(link);
            const fromIgdb = !link.manualLink;
            // The add-on and the game it goes with, whichever side this page is.
            const names = isAddon
              ? { addon: gameName, game: link.name }
              : { addon: link.name, game: gameName };
            return (
              <Box
                component="li"
                key={link.id}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
              >
                <Avatar
                  variant="rounded"
                  src={link.coverUrl ?? undefined}
                  alt=""
                  sx={{ width: 30, height: 40 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Link
                    component={RouterLink}
                    to={`/${isAddon ? "game" : "addon"}/${gameIdentifier(link)}`}
                    underline="hover"
                    color="text.primary"
                    variant="body2"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {link.name}
                  </Link>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {[
                      fromIgdb ? t("games.addonLinks.fromIgdb") : null,
                      t(relationLabelKey(relation)),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                <RelationButton
                  value={relation}
                  addon={names.addon}
                  game={names.game}
                  disabled={setRelation.isPending && relationOverrides.has(link.id)}
                  onChange={(next) => void handleRelation(link, next)}
                />
                {fromIgdb ? (
                  // IGDB's own link can't be unlinked.
                  <LockedUnlinkButton />
                ) : (
                  <Tooltip title={t("games.addonLinks.unlink")}>
                    <IconButton
                      size="small"
                      aria-label={t("games.addonLinks.unlinkLabel", { name: link.name })}
                      onClick={() => void handleUnlink(link)}
                    >
                      <LinkOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Box>
      )}
      {moreCount > 0 ? (
        <Button
          size="small"
          onClick={() => setExpanded((previous) => !previous)}
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 1 }}
        >
          {expanded
            ? t("games.addonLinks.showFewer")
            : t("games.addonLinks.showMore", { count: moreCount })}
        </Button>
      ) : null}

      <LinkAddonsDialog
        open={pickerOpen}
        gameId={gameId}
        gameName={gameName}
        isAddon={isAddon}
        offerBaseGameAddons={offerBaseGameAddons}
        onClose={() => setPickerOpen(false)}
      />
      <ConfirmDialog
        open={orphan !== null}
        title={t("games.addonLinks.lastLinkTitle")}
        description={t("games.addonLinks.lastLinkDescription", { name: orphanAddon?.name ?? "" })}
        confirmLabel={t("games.addonLinks.deleteAddon")}
        confirmColor="error"
        busy={deleteGame.isPending}
        onClose={() => setOrphan(null)}
        onConfirm={() => void handleDeleteOrphan()}
      />
    </Section>
  );
};

export default LinkedAddonsSection;
