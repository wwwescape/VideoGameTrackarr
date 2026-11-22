import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isAxiosError } from "axios";
import AddLinkIcon from "@mui/icons-material/AddLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LAST_LINK_ORPHAN } from "../api/addonLinks";
import type { GameSummary } from "../api/types";
import { useAddAddonLinks, useRemoveAddonLink } from "../hooks/useAddonLinks";
import { useDeleteGame } from "../hooks/useGames";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { Section, SectionAction } from "./Detail";
import LinkAddonsDialog from "./LinkAddonsDialog";
import { showUndoToast } from "./UndoToast";

interface LinkedAddonsSectionProps {
  gameId: number;
  gameName: string;
  // On an add-on this lists and links games; on a game it lists and links add-ons.
  isAddon: boolean;
  // Only the manual links (IGDB's own aren't unlinkable, and show in the main column).
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

// Below Notes on every game and add-on page: the manual "works with" links on this side, with
// Link opening the picker and × unlinking straight away (Undo puts it back). Removing an
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
  const removeLink = useRemoveAddonLink(gameId);
  const addLinks = useAddAddonLinks(gameId);
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
          addLinks.mutateAsync([other.id]).catch((error) => {
            console.error("Error restoring link:", error);
            toast.error(t("games.addonLinks.linkError"), TOAST_OPTIONS);
          });
        },
        5000
      );
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.detail === LAST_LINK_ORPHAN) {
        setOrphan(other);
      } else {
        console.error("Error unlinking:", error);
        toast.error(t("games.addonLinks.unlinkError"), TOAST_OPTIONS);
      }
    } finally {
      setHidden(other.id, false);
    }
  };

  // The add-on that would be left attached to nothing: this page's own, or the linked one.
  const orphanAddon = orphan ? (isAddon ? { id: gameId, name: gameName } : { id: orphan.id, name: orphan.name }) : null;

  const handleDeleteOrphan = async () => {
    if (!orphanAddon) return;
    try {
      await deleteGame.mutateAsync(orphanAddon.id);
      setOrphan(null);
      toast.success(t("games.addonLinks.addonDeletedToast", { name: orphanAddon.name }), TOAST_OPTIONS);
      if (orphanAddon.id === gameId) onCurrentGameDeleted();
    } catch (error) {
      console.error("Error deleting add-on:", error);
      toast.error(t("games.actions.removeErrorToast"), TOAST_OPTIONS);
    }
  };

  const visible = (links ?? []).filter((link) => !hiddenIds.has(link.id));

  return (
    <Section
      id="linked-addons"
      title={t(isAddon ? "games.addonLinks.linkedGamesTitle" : "games.addonLinks.linkedAddonsTitle")}
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
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {visible.map((link) => (
            <Box component="li" key={link.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
              <Avatar variant="rounded" src={link.coverUrl ?? undefined} alt="" sx={{ width: 30, height: 40 }} />
              <Link
                component={RouterLink}
                to={`/${isAddon ? "game" : "addon"}/${gameIdentifier(link)}`}
                underline="hover"
                color="text.primary"
                variant="body2"
                sx={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {link.name}
              </Link>
              <Tooltip title={t("games.addonLinks.unlink")}>
                <IconButton
                  size="small"
                  aria-label={t("games.addonLinks.unlinkLabel", { name: link.name })}
                  onClick={() => void handleUnlink(link)}
                >
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

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
