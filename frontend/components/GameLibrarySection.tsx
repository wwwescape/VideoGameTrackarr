import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Backdrop from "@mui/material/Backdrop";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { LibraryItem, LibraryStatus, MediaFormat, PlatformResponse, RegionResponse } from "../api/types";
import { useAddLibraryItem, useDeleteLibraryItem, useUpdateLibraryItem } from "../hooks/useLibrary";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import LibraryItemDialog, { type LibraryItemFormValues } from "./LibraryItemDialog";
import { showUndoToast } from "./UndoToast";

interface GameLibrarySectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  platforms: PlatformResponse[] | undefined;
  regions: RegionResponse[] | undefined;
}

const GameLibrarySection = ({ gameId, libraryItems, platforms, regions }: GameLibrarySectionProps) => {
  const { t } = useTranslation();
  const addLibraryItem = useAddLibraryItem(gameId);
  const updateLibraryItem = useUpdateLibraryItem(gameId);
  const deleteLibraryItem = useDeleteLibraryItem(gameId);

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

  const headCells: HeadCell[] = [
    { id: "platformName", numeric: false, disablePadding: false, label: t("games.library.platformColumn"), disableHeader: false },
    { id: "regionName", numeric: false, disablePadding: false, label: t("games.library.regionColumn"), disableHeader: false },
    { id: "formatLabel", numeric: false, disablePadding: false, label: t("games.library.formatColumn"), disableHeader: false },
    { id: "move", numeric: false, disablePadding: true, label: t("games.library.moveColumn"), disableHeader: true },
    { id: "edit", numeric: false, disablePadding: true, label: t("common.edit"), disableHeader: true },
    { id: "delete", numeric: false, disablePadding: true, label: t("common.delete"), disableHeader: true },
  ];

  // "collection"/"wishlist" phrases used inside toast/dialog sentences below.
  const statusPhrase: Record<LibraryStatus, string> = {
    owned: t("games.library.collectionPhrase"),
    wishlist: t("games.library.wishlistPhrase"),
  };

  const toTableRow = (item: LibraryItem) => ({
    id: item.id,
    platformName: item.platformName ?? "-",
    regionName: item.regionName ?? "-",
    formatLabel: item.format ? formatLabels[item.format] : "-",
  });

  const { schedule: scheduleItemRemoval, isPending: isItemPending } = useUndoableAction<LibraryItem>({
    getId: (item) => item.id,
    onCommit: async (items) => {
      await Promise.all(items.map((item) => deleteLibraryItem.mutateAsync(item.id)));
    },
  });

  const owned = (libraryItems ?? []).filter((item) => item.status === "owned" && !isItemPending(item.id)).map(toTableRow);
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

  const handleMoveClick = async (rowId: number, currentStatus: LibraryStatus) => {
    const item = libraryItems?.find((candidate) => candidate.id === rowId);
    if (!item) return;
    const targetStatus: LibraryStatus = currentStatus === "owned" ? "wishlist" : "owned";
    try {
      await updateLibraryItem.mutateAsync({ itemId: item.id, input: { status: targetStatus } });
      toast.success(t("games.library.moveSuccessToast", { phrase: statusPhrase[targetStatus] }), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error moving game status:", error);
      toast.error(t("games.library.moveErrorToast", { phrase: statusPhrase[targetStatus] }), TOAST_OPTIONS);
    }
  };

  const handleDialogSubmit = async (values: LibraryItemFormValues) => {
    try {
      if (dialogItem) {
        await updateLibraryItem.mutateAsync({ itemId: dialogItem.id, input: { ...values, status: dialogStatus } });
        toast.success(t("games.library.updateSuccessToast", { phrase: statusPhrase[dialogStatus] }), TOAST_OPTIONS);
      } else {
        await addLibraryItem.mutateAsync({ ...values, status: dialogStatus });
        toast.success(t("games.library.addSuccessToast", { phrase: statusPhrase[dialogStatus] }), TOAST_OPTIONS);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving library item:", error);
      toast.error(t("games.library.saveErrorToast", { phrase: statusPhrase[dialogStatus] }), TOAST_OPTIONS);
    }
  };

  const isMutating = addLibraryItem.isPending || updateLibraryItem.isPending || deleteLibraryItem.isPending;

  return (
    <>
      {isMutating && (
        <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }} open={isMutating}>
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
          platforms={platforms ?? []}
          regions={regions ?? []}
          defaultValues={
            dialogItem
              ? {
                  platformId: dialogItem.platformId ?? undefined,
                  regionId: dialogItem.regionId ?? undefined,
                  format: dialogItem.format ?? "physical",
                  digitalStorefront: dialogItem.digitalStorefront ?? "",
                  ratingBoard: dialogItem.ratingBoard ?? undefined,
                  price: dialogItem.price ?? undefined,
                }
              : undefined
          }
          onClose={() => setDialogOpen(false)}
          onSubmit={handleDialogSubmit}
          submitLabel={dialogItem ? t("games.library.updateLabel") : t("common.add")}
        />
      </CardContent>
    </>
  );
};

export default GameLibrarySection;
