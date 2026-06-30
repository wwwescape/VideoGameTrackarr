import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Backdrop from "@mui/material/Backdrop";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CircularProgress from "@mui/material/CircularProgress";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { LibraryItem, LibraryStatus, MediaFormat, PlatformResponse, RegionResponse } from "../api/types";
import { useAddLibraryItem, useDeleteLibraryItem, useUpdateLibraryItem } from "../hooks/useLibrary";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import LibraryItemDialog, { type LibraryItemFormValues } from "./LibraryItemDialog";
import { showUndoToast } from "./UndoToast";

const FORMAT_LABELS: Record<MediaFormat, string> = {
  physical: "Physical",
  digital: "Digital",
  iso: "ISO",
  rom: "ROM",
  abandonware: "Abandonware",
  other: "Other",
};

const HEAD_CELLS: HeadCell[] = [
  { id: "platformName", numeric: false, disablePadding: false, label: "Platform", disableHeader: false },
  { id: "regionName", numeric: false, disablePadding: false, label: "Region", disableHeader: false },
  { id: "formatLabel", numeric: false, disablePadding: false, label: "Format", disableHeader: false },
  { id: "move", numeric: false, disablePadding: true, label: "Move", disableHeader: true },
  { id: "edit", numeric: false, disablePadding: true, label: "Edit", disableHeader: true },
  { id: "delete", numeric: false, disablePadding: true, label: "Delete", disableHeader: true },
];

// EnhancedTable's "tableName" is a display label ("Collection"/"Wishlist"); these map it
// back to the real status values the API understands.
const STATUS_BY_TABLE_NAME: Record<string, LibraryStatus> = {
  collection: "owned",
  wishlist: "wishlist",
};
const STATUS_PHRASE: Record<LibraryStatus, string> = { owned: "collection", wishlist: "wishlist" };

function toTableRow(item: LibraryItem) {
  return {
    id: item.id,
    platformName: item.platformName ?? "-",
    regionName: item.regionName ?? "-",
    formatLabel: item.format ? FORMAT_LABELS[item.format] : "-",
  };
}

interface GameLibrarySectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  platforms: PlatformResponse[] | undefined;
  regions: RegionResponse[] | undefined;
}

const GameLibrarySection = ({ gameId, libraryItems, platforms, regions }: GameLibrarySectionProps) => {
  const addLibraryItem = useAddLibraryItem(gameId);
  const updateLibraryItem = useUpdateLibraryItem(gameId);
  const deleteLibraryItem = useDeleteLibraryItem(gameId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<LibraryItem | null>(null);
  const [dialogStatus, setDialogStatus] = useState<LibraryStatus>("owned");

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

  const handleAddClick = (tableName: string) => {
    setDialogStatus(STATUS_BY_TABLE_NAME[tableName]);
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

  const handleDeleteClick = (selectedIds: number[], tableName: string) => {
    const status = STATUS_BY_TABLE_NAME[tableName];
    const itemsToRemove = (libraryItems ?? []).filter((item) => selectedIds.includes(item.id));
    if (itemsToRemove.length === 0) return;
    const { undo } = scheduleItemRemoval(itemsToRemove);
    const phrase = STATUS_PHRASE[status];
    showUndoToast(
      `${itemsToRemove.length > 1 ? "Entries" : "Entry"} removed from your ${phrase}`,
      undo,
      5000
    );
  };

  const handleMoveClick = async (rowId: number, tableName: string) => {
    const item = libraryItems?.find((candidate) => candidate.id === rowId);
    if (!item) return;
    const currentStatus = STATUS_BY_TABLE_NAME[tableName];
    const targetStatus: LibraryStatus = currentStatus === "owned" ? "wishlist" : "owned";
    try {
      await updateLibraryItem.mutateAsync({ itemId: item.id, input: { status: targetStatus } });
      toast.success(`Game moved to your ${STATUS_PHRASE[targetStatus]} successfully!`, TOAST_OPTIONS);
    } catch (error) {
      console.error("Error moving game status:", error);
      toast.error(`Error moving game to your ${STATUS_PHRASE[targetStatus]}. Please try again.`, TOAST_OPTIONS);
    }
  };

  const handleDialogSubmit = async (values: LibraryItemFormValues) => {
    try {
      if (dialogItem) {
        await updateLibraryItem.mutateAsync({ itemId: dialogItem.id, input: { ...values, status: dialogStatus } });
        toast.success(`Game updated in your ${STATUS_PHRASE[dialogStatus]} successfully!`, TOAST_OPTIONS);
      } else {
        await addLibraryItem.mutateAsync({ ...values, status: dialogStatus });
        toast.success(`Game added to your ${STATUS_PHRASE[dialogStatus]} successfully!`, TOAST_OPTIONS);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving library item:", error);
      toast.error(`Error saving game in your ${STATUS_PHRASE[dialogStatus]}. Please try again.`, TOAST_OPTIONS);
    }
  };

  const isMutating = addLibraryItem.isPending || updateLibraryItem.isPending || deleteLibraryItem.isPending;

  return (
    <>
      {isMutating && (
        <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.modal + 1 }} open={isMutating}>
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <CardHeader title="Your library" subheader="Collection and wishlist entries across platforms and regions" />
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <EnhancedTable
          rows={owned}
          headCells={HEAD_CELLS}
          tableName="Collection"
          tableIcon={<CheckCircleIcon color="secondary" />}
          onAddClick={handleAddClick}
          onDeleteClick={handleDeleteClick}
          onMoveClick={handleMoveClick}
          moveDirection="down"
          onEditClick={handleEditClick}
        />
        <EnhancedTable
          rows={wishlisted}
          headCells={HEAD_CELLS}
          tableName="Wishlist"
          tableIcon={<FavoriteIcon color="secondary" />}
          onAddClick={handleAddClick}
          onDeleteClick={handleDeleteClick}
          onMoveClick={handleMoveClick}
          moveDirection="up"
          onEditClick={handleEditClick}
        />

        <LibraryItemDialog
          open={dialogOpen}
          title={dialogItem ? `Update game in your ${STATUS_PHRASE[dialogStatus]}` : `Add game to your ${STATUS_PHRASE[dialogStatus]}`}
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
          submitLabel={dialogItem ? "Update" : "Add"}
        />
      </CardContent>
    </>
  );
};

export default GameLibrarySection;
