import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
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
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import LibraryItemDialog, { type LibraryItemFormValues, type RomChanges } from "./LibraryItemDialog";
import { showUndoToast } from "./UndoToast";

// Shared across the Owned and Wishlist tables below so their Platform/Format & Storefront/
// Edition/Steelbook/action columns line up pixel-for-pixel — the two tables are now fully
// identical in column set/widths, not just "mostly." There's deliberately no separate On
// Sale column any more: it used to be a whole extra fixed-width column just for Wishlist,
// which made Wishlist wider than Owned and was the direct cause of a real overflow bug (a
// minWidth wide enough for Wishlist's extra column exceeded the real card width). Folding
// the on-sale chip into the Platform cell itself (see renderPlatformCell below) removes that
// asymmetry entirely instead of just budgeting tighter around it.
//
// platformName deliberately does NOT use the shared PLATFORM_COLUMN_WIDTH constant (unlike
// every other EnhancedTable-based game table) — this column now also has to make room for
// the on-sale chip overlay, which no other table needs.
const COLUMN_WIDTHS = {
  platformName: 200,
  formatStorefront: 170,
  edition: 110,
  steelbook: 80,
} as const;

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

  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    other: t("games.library.formatOther"),
  };

  const commonHeadCells: HeadCell[] = [
    {
      id: "platformName",
      numeric: false,
      disablePadding: false,
      label: t("games.library.platformColumn"),
      disableHeader: false,
      width: COLUMN_WIDTHS.platformName,
    },
    {
      id: "formatStorefront",
      numeric: false,
      disablePadding: false,
      label: t("games.library.formatStorefrontColumn"),
      disableHeader: false,
      width: COLUMN_WIDTHS.formatStorefront,
    },
    {
      id: "edition",
      numeric: false,
      disablePadding: false,
      label: t("games.library.editionColumn"),
      disableHeader: false,
      width: COLUMN_WIDTHS.edition,
    },
    {
      id: "steelbook",
      numeric: false,
      disablePadding: false,
      label: t("games.library.steelbookColumn"),
      disableHeader: false,
      width: COLUMN_WIDTHS.steelbook,
    },
  ];

  // One combined column for Move/Edit/Delete rather than three separate ones — always the
  // last column, so it's the one EnhancedTable.tsx leaves unwidthed to soak up the table's
  // remaining space and land flush against the toolbar's Add button; keeping the icons
  // inside a single cell (spaced via a Stack) is what keeps them clustered neatly together
  // as that cell grows, instead of each icon staying pinned to its own fixed-width slot.
  const actionsHeadCell: HeadCell = {
    id: "actions",
    numeric: false,
    disablePadding: true,
    label: t("common.actions"),
    disableHeader: true,
  };

  // Owned and Wishlist now share the exact same column set — see the COLUMN_WIDTHS comment
  // above for why the on-sale chip no longer gets its own dedicated column.
  const headCells: HeadCell[] = [...commonHeadCells, actionsHeadCell];

  // "collection"/"wishlist" phrases used inside toast/dialog sentences below.
  const statusPhrase: Record<LibraryStatus, string> = {
    owned: t("games.library.collectionPhrase"),
    wishlist: t("games.library.wishlistPhrase"),
  };

  const renderSaleChip = (item: LibraryItem) => {
    if (!item.isOnSale) return null;
    return (
      <Tooltip
        title={t("insights.onSale.currentPriceLabel", {
          price: formatCurrency(item.salePriceAmount ?? 0, item.salePriceCurrency ?? "USD"),
          shop: item.saleShopName ?? t("common.unknown"),
          cut: item.saleCut ?? 0,
        })}
      >
        <Chip size="small" color="success" label={t("games.card.onSaleLabel")} />
      </Tooltip>
    );
  };

  // Wishlist-only (an owned copy has no use for an "on sale" indicator — see renderSaleChip)
  // — right-aligned over the Platform cell rather than its own column, so a discounted row
  // doesn't need any more width than every other row. The platform name stays in place at
  // reduced opacity behind the chip instead of disappearing, so the platform is still
  // readable at a glance even when the chip visually overlaps it.
  const renderPlatformCell = (item: LibraryItem) => {
    const platformLabel = item.platformName ?? "-";
    const chip = item.status === "wishlist" ? renderSaleChip(item) : null;
    if (!chip) return platformLabel;
    return (
      <Box sx={{ position: "relative", display: "flex", alignItems: "center", minHeight: 24 }}>
        <Box
          component="span"
          sx={{ opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {platformLabel}
        </Box>
        <Box sx={{ position: "absolute", right: 0, display: "flex", alignItems: "center" }}>
          {chip}
        </Box>
      </Box>
    );
  };

  // One combined "Physical" / "Digital: Steam" / "ISO" column rather than two — a storefront
  // only ever exists alongside a Digital format (see LibraryItemDialog.tsx), so a separate
  // Storefront column left every non-Digital row's cell blank; folding it into Format via
  // "Format: Storefront" carries the same information without a mostly-empty column of its
  // own.
  const formatStorefrontLabel = (item: LibraryItem): string => {
    if (!item.format) return "-";
    const label = formatLabels[item.format];
    return item.format === "digital" && item.digitalStorefront
      ? `${label}: ${item.digitalStorefront}`
      : label;
  };

  const romNames = (item: LibraryItem) =>
    item.roms.map((rom) => (rom.label ? `${rom.label} (${rom.originalFilename})` : rom.originalFilename)).join(", ");

  const renderFormatStorefrontCell = (item: LibraryItem) => {
    const label = formatStorefrontLabel(item);
    if (item.roms.length === 0) return label;
    const tooltip = t("games.library.romAttachedTooltip", { count: item.roms.length, name: romNames(item) });
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        {label}
        <Tooltip title={tooltip}>
          <Box component="span" aria-label={tooltip} sx={{ display: "inline-flex", alignItems: "center" }}>
            <SportsEsportsIcon fontSize="small" color={item.roms.some((rom) => rom.playable) ? "success" : "disabled"} />
            {/* Inline rather than a Badge, which the table row would clip. */}
            {item.roms.length > 1 ? (
              <Box component="span" sx={{ fontSize: 12, fontWeight: 500, ml: 0.25 }}>
                ×{item.roms.length}
              </Box>
            ) : null}
          </Box>
        </Tooltip>
      </Box>
    );
  };

  const toTableRow = (item: LibraryItem) => ({
    id: item.id,
    platformName: renderPlatformCell(item),
    formatStorefront: renderFormatStorefrontCell(item),
    edition: item.edition ?? "-",
    steelbook: item.steelbook ? (
      <Tooltip title={t("games.library.steelbookColumn")}>
        <CheckIcon fontSize="small" color="success" aria-label={t("games.library.steelbookColumn")} />
      </Tooltip>
    ) : null,
  });

  const { schedule: scheduleItemRemoval, isPending: isItemPending } =
    useUndoableAction<LibraryItem>({
      getId: (item) => item.id,
      onCommit: async (items) => {
        await Promise.all(items.map((item) => deleteLibraryItem.mutateAsync(item.id)));
      },
    });

  const owned = (libraryItems ?? [])
    .filter((item) => item.status === "owned" && !isItemPending(item.id))
    .map(toTableRow);
  const wishlisted = (libraryItems ?? [])
    .filter((item) => item.status === "wishlist" && !isItemPending(item.id))
    .map(toTableRow);

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

  const handleDeleteClick = (selectedIds: number[], status: LibraryStatus) => {
    const itemsToRemove = (libraryItems ?? []).filter((item) => selectedIds.includes(item.id));
    if (itemsToRemove.length === 0) return;
    const { undo } = scheduleItemRemoval(itemsToRemove);
    const phrase = statusPhrase[status];
    showUndoToast(
      t("games.library.removedFromToast", { count: itemsToRemove.length, phrase }),
      undo,
      5000
    );
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
      <CardHeader title={t("games.library.title")} subheader={t("games.library.subheader")} />
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <EnhancedTable
          rows={owned}
          headCells={headCells}
          tableName={t("games.library.collectionTableName")}
          tableIcon={<CheckCircleIcon color="secondary" />}
          onAddClick={() => handleAddClick("owned")}
          onDeleteClick={(ids) => handleDeleteClick(ids, "owned")}
          onMoveClick={(rowId) => handleMoveClick(rowId, "owned")}
          moveDirection="down"
          onEditClick={handleEditClick}
        />
        <EnhancedTable
          rows={wishlisted}
          headCells={headCells}
          tableName={t("games.library.wishlistTableName")}
          tableIcon={<FavoriteIcon color="secondary" />}
          onAddClick={() => handleAddClick("wishlist")}
          onDeleteClick={(ids) => handleDeleteClick(ids, "wishlist")}
          onMoveClick={(rowId) => handleMoveClick(rowId, "wishlist")}
          moveDirection="up"
          onEditClick={handleEditClick}
        />

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
      </CardContent>
    </>
  );
};

export default GameLibrarySection;
