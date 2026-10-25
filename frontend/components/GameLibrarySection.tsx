import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type {
  GameCategory,
  LibraryItem,
  LibraryStatus,
  MediaFormat,
  PlatformResponse,
  RegionResponse,
} from "../api/types";
import {
  useAddLibraryItem,
  useAddRom,
  useDeleteLibraryItem,
  useDeleteRom,
  useReplaceRom,
  useUpdateLibraryItem,
  useUpdateRomLabel,
} from "../hooks/useLibrary";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { formatCurrency } from "../utils/currency";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import LibraryItemDialog, { type LibraryItemFormValues, type RomChanges } from "./LibraryItemDialog";
import { showUndoToast } from "./UndoToast";
import { EmptyLine, ListRow, Panel, Pill, PlatformBadge, RowAction, Section, SectionAction } from "./Detail";

interface GameLibrarySectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  platforms: PlatformResponse[] | undefined;
  regions: RegionResponse[] | undefined;
  gameCategory?: GameCategory | null;
}

const GameLibrarySection = ({
  gameId,
  libraryItems,
  platforms,
  regions,
  gameCategory,
}: GameLibrarySectionProps) => {
  const { t } = useTranslation();
  const addLibraryItem = useAddLibraryItem(gameId);
  const updateLibraryItem = useUpdateLibraryItem(gameId);
  const deleteLibraryItem = useDeleteLibraryItem(gameId);
  const addRom = useAddRom(gameId);
  const replaceRom = useReplaceRom(gameId);
  const updateRomLabel = useUpdateRomLabel(gameId);
  const deleteRom = useDeleteRom(gameId);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStep, setUploadStep] = useState<{ current: number; total: number } | null>(null);
  // Moving an owned copy that holds a ROM to the Wishlist deletes the ROM (see
  // library_service.update_library_item) — confirmed first, unlike an ordinary move.
  const [moveConfirmItem, setMoveConfirmItem] = useState<LibraryItem | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<LibraryItem | null>(null);
  const [dialogStatus, setDialogStatus] = useState<LibraryStatus>("owned");
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);

  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    other: t("games.library.formatOther"),
  };

  // "collection"/"wishlist" phrases used inside toast/dialog sentences below.
  const statusPhrase: Record<LibraryStatus, string> = {
    owned: t("games.library.collectionPhrase"),
    wishlist: t("games.library.wishlistPhrase"),
  };

  // A wishlisted copy that's on sale: its own green line under the copy's details, with the
  // price, shop and discount spelled out rather than hidden in a tooltip.
  const renderSaleLine = (item: LibraryItem) => {
    if (item.status !== "wishlist" || !item.isOnSale) return null;
    return (
      <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "vgt.owned", fontWeight: 600 }}>
        <SellOutlinedIcon sx={{ fontSize: 15 }} />
        {t("games.library.onSaleLine", {
          price: formatCurrency(item.salePriceAmount ?? 0, item.salePriceCurrency ?? "USD"),
          shop: item.saleShopName ?? t("common.unknown"),
          cut: item.saleCut ?? 0,
        })}
      </Box>
    );
  };

  // "Physical" / "Digital: Steam" / "ISO" — a storefront only ever exists alongside a Digital
  // format (see LibraryItemDialog.tsx).
  const formatStorefrontLabel = (item: LibraryItem): string | null => {
    if (!item.format) return null;
    const label = formatLabels[item.format];
    return item.format === "digital" && item.digitalStorefront
      ? `${label}: ${item.digitalStorefront}`
      : label;
  };

  const romNames = (item: LibraryItem) =>
    item.roms.map((rom) => (rom.label ? `${rom.label} (${rom.originalFilename})` : rom.originalFilename)).join(", ");

  const renderRomIcon = (item: LibraryItem) => {
    if (item.roms.length === 0) return null;
    const tooltip = t("games.library.romAttachedTooltip", { count: item.roms.length, name: romNames(item) });
    return (
      <Tooltip title={tooltip}>
        <Box component="span" aria-label={tooltip} sx={{ display: "inline-flex", alignItems: "center" }}>
          <SportsEsportsIcon fontSize="small" color={item.roms.some((rom) => rom.playable) ? "success" : "disabled"} />
          {item.roms.length > 1 ? (
            <Box component="span" sx={{ fontSize: 12, fontWeight: 500, ml: 0.25 }}>
              ×{item.roms.length}
            </Box>
          ) : null}
        </Box>
      </Tooltip>
    );
  };

  const platformBadge = (item: LibraryItem) => {
    const platform = platforms?.find((candidate) => candidate.id === item.platformId);
    return platform?.abbreviation || item.platformName?.split(" ")[0] || "?";
  };

  const { schedule: scheduleItemRemoval, isPending: isItemPending } =
    useUndoableAction<LibraryItem>({
      getId: (item) => item.id,
      onCommit: async (items) => {
        await Promise.all(items.map((item) => deleteLibraryItem.mutateAsync(item.id)));
      },
    });

  // Owned copies first, then the wishlist, as the two tables used to be.
  const visibleItems = (libraryItems ?? [])
    .filter((item) => !isItemPending(item.id))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "owned" ? -1 : 1));

  const handleAddClick = (status: LibraryStatus) => {
    setDialogStatus(status);
    setDialogItem(null);
    setDialogOpen(true);
  };

  const handleEditClick = (rowId: number) => {
    const item = libraryItems?.find((candidate) => candidate.id === rowId);
    if (!item) return;
    setDialogStatus(item.status);
    setDialogItem(item);
    setDialogOpen(true);
  };

  const handleRemove = (item: LibraryItem) => {
    const { undo } = scheduleItemRemoval([item]);
    showUndoToast(t("games.library.removedFromToast", { count: 1, phrase: statusPhrase[item.status] }), undo, 5000);
  };

  const handleMoveClick = async (rowId: number, currentStatus: LibraryStatus, confirmed = false) => {
    const item = libraryItems?.find((candidate) => candidate.id === rowId);
    if (!item) return;
    const targetStatus: LibraryStatus = currentStatus === "owned" ? "wishlist" : "owned";
    if (targetStatus === "wishlist" && item.roms.length > 0 && !confirmed) {
      setMoveConfirmItem(item);
      return;
    }
    try {
      await updateLibraryItem.mutateAsync({ itemId: item.id, input: { status: targetStatus } });
      toast.success(
        t("games.library.moveSuccessToast", { phrase: statusPhrase[targetStatus] }),
        TOAST_OPTIONS
      );
    } catch (error) {
      console.error("Error moving game status:", error);
      toast.error(
        t("games.library.moveErrorToast", { phrase: statusPhrase[targetStatus] }),
        TOAST_OPTIONS
      );
    }
  };

  // Each ROM change is its own request, applied one at a time once the copy is saved (a new
  // copy only has an id after the create call returns). Removals go first so a replace-by-
  // remove-and-add never briefly holds both files.
  const applyRomChanges = async (itemId: number, changes: RomChanges): Promise<boolean> => {
    const uploads = [
      ...changes.replaced.map((change) => () =>
        replaceRom.mutateAsync({ romId: change.romId, file: change.file, onProgress: setUploadProgress })
      ),
      ...changes.added.map((change) => () =>
        addRom.mutateAsync({ itemId, file: change.file, label: change.label, onProgress: setUploadProgress })
      ),
    ];
    try {
      for (const romId of changes.removed) {
        await deleteRom.mutateAsync(romId);
      }
      for (const change of changes.relabelled) {
        await updateRomLabel.mutateAsync(change);
      }
      for (const [index, upload] of uploads.entries()) {
        setUploadStep({ current: index + 1, total: uploads.length });
        setUploadProgress(0);
        await upload();
      }
      return true;
    } catch (error) {
      console.error("Error saving ROM:", error);
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      toast.error(
        typeof detail === "string"
          ? t("games.library.romSaveErrorDetailToast", { detail })
          : t("games.library.romSaveErrorToast"),
        TOAST_OPTIONS
      );
      return false;
    } finally {
      setUploadProgress(null);
      setUploadStep(null);
    }
  };

  const handleDialogSubmit = async (values: LibraryItemFormValues, romChanges: RomChanges) => {
    let savedItem: LibraryItem;
    try {
      if (dialogItem) {
        savedItem = await updateLibraryItem.mutateAsync({
          itemId: dialogItem.id,
          input: { ...values, status: dialogStatus },
        });
      } else {
        savedItem = await addLibraryItem.mutateAsync({ ...values, status: dialogStatus });
      }
    } catch (error) {
      console.error("Error saving library item:", error);
      toast.error(
        t("games.library.saveErrorToast", { phrase: statusPhrase[dialogStatus] }),
        TOAST_OPTIONS
      );
      return;
    }
    if (!(await applyRomChanges(savedItem.id, romChanges))) {
      // The copy (and whichever ROM changes did go through) is saved; the toast says to open
      // it again to retry the rest, which starts from what the server now actually holds.
      setDialogOpen(false);
      return;
    }
    toast.success(
      dialogItem
        ? t("games.library.updateSuccessToast", { phrase: statusPhrase[dialogStatus] })
        : t("games.library.addSuccessToast", { phrase: statusPhrase[dialogStatus] }),
      TOAST_OPTIONS
    );
    setDialogOpen(false);
  };

  const isMutating =
    addLibraryItem.isPending || updateLibraryItem.isPending || deleteLibraryItem.isPending;

  return (
    <>
      {isMutating && (
        <Backdrop
          sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }}
          open={isMutating}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Section
        id="library"
        title={t("games.library.title")}
        action={
          <SectionAction
            icon={<AddIcon />}
            label={t("games.library.addCopy")}
            onClick={(event) => setAddMenuAnchor(event.currentTarget)}
            aria-haspopup="menu"
          />
        }
      >
        <Menu anchorEl={addMenuAnchor} open={addMenuAnchor !== null} onClose={() => setAddMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setAddMenuAnchor(null);
              handleAddClick("owned");
            }}
          >
            <ListItemIcon>
              <CheckIcon fontSize="small" />
            </ListItemIcon>
            {t("games.library.addToCollection")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchor(null);
              handleAddClick("wishlist");
            }}
          >
            <ListItemIcon>
              <FavoriteIcon fontSize="small" />
            </ListItemIcon>
            {t("games.library.addToWishlist")}
          </MenuItem>
        </Menu>
        {visibleItems.length === 0 ? (
          <EmptyLine>{t("games.library.empty")}</EmptyLine>
        ) : (
          <Panel>
            {visibleItems.map((item) => {
              const owned = item.status === "owned";
              // Format, with Steelbook only for a physical copy marked as one.
              const formatLine = [
                formatStorefrontLabel(item),
                item.format === "physical" && item.steelbook ? t("games.library.steelbookColumn") : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ListRow
                  key={item.id}
                  label={item.platformName ?? t("games.about.unknownPlatform")}
                  onClick={() => handleEditClick(item.id)}
                  leading={<PlatformBadge>{platformBadge(item)}</PlatformBadge>}
                  title={item.platformName ?? t("games.about.unknownPlatform")}
                  subtitle={
                    <>
                      {formatLine || item.roms.length ? (
                        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          {formatLine}
                          {renderRomIcon(item)}
                        </Box>
                      ) : null}
                      {item.edition ? <Box component="span" sx={{ display: "block" }}>{item.edition}</Box> : null}
                      {renderSaleLine(item)}
                    </>
                  }
                  trailing={
                    <Pill small tone={owned ? "owned" : "wishlist"} icon={owned ? <CheckIcon /> : <FavoriteIcon />}>
                      {owned ? t("games.library.ownedChip") : t("games.library.wishlistChip")}
                    </Pill>
                  }
                  actions={
                    <>
                      <RowAction
                        title={owned ? t("table.moveToWishlist") : t("table.moveToCollection")}
                        icon={owned ? <FavoriteBorderIcon fontSize="small" /> : <CheckIcon fontSize="small" />}
                        onClick={() => void handleMoveClick(item.id, item.status)}
                      />
                      <RowAction
                        title={t("common.remove")}
                        icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                        onClick={() => handleRemove(item)}
                      />
                    </>
                  }
                />
              );
            })}
          </Panel>
        )}
      </Section>

        <LibraryItemDialog
          open={dialogOpen}
          title={
            dialogItem
              ? t("games.library.updateDialogTitle", { phrase: statusPhrase[dialogStatus] })
              : t("games.library.addDialogTitle", { phrase: statusPhrase[dialogStatus] })
          }
          status={dialogStatus}
          platforms={platforms ?? []}
          regions={regions ?? []}
          gameCategory={gameCategory}
          defaultValues={
            dialogItem
              ? {
                  platformId: dialogItem.platformId ?? undefined,
                  regionId: dialogItem.regionId ?? undefined,
                  format: dialogItem.format ?? "physical",
                  digitalStorefront: dialogItem.digitalStorefront ?? "",
                  ratingBoard: dialogItem.ratingBoard ?? undefined,
                  edition: dialogItem.edition ?? "",
                  price: dialogItem.price ?? undefined,
                  targetPrice: dialogItem.targetPrice ?? undefined,
                  trackForSales: dialogItem.trackForSales,
                  steelbook: dialogItem.steelbook,
                  notes: dialogItem.notes ?? "",
                }
              : undefined
          }
          existingRoms={dialogItem?.roms ?? []}
          uploadProgress={uploadProgress}
          uploadStep={uploadStep}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values, romChange) => void handleDialogSubmit(values, romChange)}
          submitLabel={dialogItem ? t("games.library.updateLabel") : t("common.add")}
        />
        <ConfirmDialog
          open={moveConfirmItem != null}
          title={t("games.library.moveWithRomTitle")}
          description={
            moveConfirmItem?.roms.some((rom) => rom.saveStateCount > 0 || rom.hasInGameSave)
              ? t("games.library.moveWithRomAndSavesDescription", {
                  count: moveConfirmItem.roms.length,
                  name: romNames(moveConfirmItem),
                })
              : t("games.library.moveWithRomDescription", {
                  count: moveConfirmItem?.roms.length ?? 0,
                  name: moveConfirmItem ? romNames(moveConfirmItem) : "",
                })
          }
          confirmLabel={t("games.library.moveWithRomConfirm")}
          confirmColor="error"
          onClose={() => setMoveConfirmItem(null)}
          onConfirm={() => {
            const item = moveConfirmItem;
            setMoveConfirmItem(null);
            if (item) void handleMoveClick(item.id, item.status, true);
          }}
        />
    </>
  );
};

export default GameLibrarySection;
