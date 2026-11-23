import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { isAxiosError } from "axios";
import AddIcon from "@mui/icons-material/Add";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";
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
import { useAddPackLinks, useRemoveFromPack } from "../hooks/useAddonLinks";
import { useDeleteGame } from "../hooks/useGames";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { Section, SectionAction } from "./Detail";
import PackLinkDialog from "./PackLinkDialog";
import { showUndoToast } from "./UndoToast";

interface PackLinksSectionProps {
  gameId: number;
  gameName: string;
  // On a pack this lists and adds what's inside it; on any other add-on, the packs it's in.
  isPack: boolean;
  items: GameSummary[] | undefined;
  // Deleting this page's own add-on (offered when the last pack holding it can't let go).
  onCurrentGameDeleted: () => void;
}

// Below Linked games on every add-on page (Linked Add-ons lab). A pack (Season Pass, Ultimate
// Pack) lists the add-ons inside it; any other add-on lists the packs it's in. Add opens the
// picker; − takes it out straight away (Undo puts it back). Everything here is Included: owning
// the pack, or a game it's Included in, owns what's inside.
const PackLinksSection = ({
  gameId,
  gameName,
  isPack,
  items,
  onCurrentGameDeleted,
}: PackLinksSectionProps) => {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(new Set());
  const [orphan, setOrphan] = useState<GameSummary | null>(null);
  const removeFromPack = useRemoveFromPack();
  const addLinks = useAddPackLinks(gameId);
  const deleteGame = useDeleteGame();

  const setHidden = (id: number, hidden: boolean) =>
    setHiddenIds((previous) => {
      const next = new Set(previous);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  // The pack and the add-on inside it, whichever side this page is.
  const pairFor = (other: GameSummary) =>
    isPack
      ? { pack: { id: gameId, name: gameName }, addon: { id: other.id, name: other.name } }
      : { pack: { id: other.id, name: other.name }, addon: { id: gameId, name: gameName } };

  const handleRemove = async (other: GameSummary) => {
    const { pack, addon } = pairFor(other);
    setHidden(other.id, true);
    try {
      await removeFromPack.mutateAsync({ packId: pack.id, addonId: addon.id });
      showUndoToast(
        t("games.packs.removedToast", { addon: addon.name, pack: pack.name }),
        () => {
          setHidden(other.id, false);
          addLinks.mutateAsync([other.id]).catch((error) => {
            console.error("Error restoring pack contents:", error);
            toast.error(t("games.packs.addError"), TOAST_OPTIONS);
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
        console.error("Error removing from pack:", error);
        toast.error(t("games.packs.removeError"), TOAST_OPTIONS);
      }
    }
  };

  // The add-on that would be left nowhere: the one inside the pack.
  const orphanAddon = orphan ? pairFor(orphan).addon : null;

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

  const visible = (items ?? []).filter((item) => !hiddenIds.has(item.id));

  return (
    <Section
      id="pack-links"
      title={t(isPack ? "games.packs.sectionContentsTitle" : "games.packs.sectionPacksTitle")}
      action={
        <SectionAction
          icon={<AddIcon />}
          label={t("games.packs.addAction")}
          onClick={() => setPickerOpen(true)}
        />
      }
    >
      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t(isPack ? "games.packs.emptyForPack" : "games.packs.emptyForAddon")}
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}
        >
          {visible.map((item) => {
            const { pack, addon } = pairFor(item);
            return (
              <Box
                component="li"
                key={item.id}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
              >
                <Avatar
                  variant="rounded"
                  src={item.coverUrl ?? undefined}
                  alt=""
                  sx={{ width: 30, height: 40 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Link
                    component={RouterLink}
                    to={`/addon/${gameIdentifier(item)}`}
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
                    {item.name}
                  </Link>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                  >
                    <Inventory2Icon sx={{ fontSize: 13 }} color="primary" />
                    {t(isPack ? "games.addonLinks.includedOption" : "games.packs.inPackCaption")}
                  </Typography>
                </Box>
                <Tooltip title={t("games.packs.remove")}>
                  <IconButton
                    size="small"
                    aria-label={t("games.packs.removeLabel", {
                      addon: addon.name,
                      pack: pack.name,
                    })}
                    onClick={() => void handleRemove(item)}
                  >
                    <RemoveCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })}
        </Box>
      )}

      <PackLinkDialog
        open={pickerOpen}
        gameId={gameId}
        gameName={gameName}
        isPack={isPack}
        onClose={() => setPickerOpen(false)}
      />
      <ConfirmDialog
        open={orphan !== null}
        title={t("games.addonLinks.lastLinkTitle")}
        description={t("games.packs.lastHolderDescription", { name: orphanAddon?.name ?? "" })}
        confirmLabel={t("games.addonLinks.deleteAddon")}
        confirmColor="error"
        busy={deleteGame.isPending}
        onClose={() => setOrphan(null)}
        onConfirm={() => void handleDeleteOrphan()}
      />
    </Section>
  );
};

export default PackLinksSection;
