import { useState } from "react";
import { isAxiosError } from "axios";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { Tag } from "../api/types";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "../hooks/useTags";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import SettingsSubNav from "./SettingsSubNav";
import TagDialog from "./TagDialog";

const TagManagerPage = () => {
  const { t } = useTranslation();
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTag, setDialogTag] = useState<Tag | null>(null);
  const [selectedPendingDelete, setSelectedPendingDelete] = useState<number[]>([]);

  const headCells: HeadCell[] = [
    { id: "name", numeric: false, disablePadding: false, label: t("settings.tagManager.nameColumn"), disableHeader: false },
    { id: "actions", numeric: false, disablePadding: true, label: t("common.actions"), disableHeader: true },
  ];

  const toTableRow = (tag: Tag) => ({
    id: tag.id,
    name: tag.name,
  });

  const rows = (tags ?? []).map(toTableRow);

  const handleAddClick = () => {
    setDialogTag(null);
    setDialogOpen(true);
  };

  const handleEditClick = (rowId: number) => {
    const tag = tags?.find((candidate) => candidate.id === rowId);
    if (!tag) return;
    setDialogTag(tag);
    setDialogOpen(true);
  };

  const handleDialogSubmit = async (values: { name: string; color: string | null; textColor: string | null }) => {
    try {
      if (dialogTag) {
        await updateTag.mutateAsync({ tagId: dialogTag.id, ...values });
        toast.success(t("settings.tagManager.updateSuccess"), TOAST_OPTIONS);
      } else {
        await createTag.mutateAsync(values);
        toast.success(t("settings.tagManager.addSuccess"), TOAST_OPTIONS);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving tag:", error);
      const message =
        isAxiosError(error) && error.response?.status === 409
          ? t("settings.tagManager.duplicateNameError")
          : t("settings.tagManager.saveError");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  const handleDeleteClick = (selectedIds: number[]) => setSelectedPendingDelete(selectedIds);

  const handleDelete = async () => {
    if (selectedPendingDelete.length === 0) return;
    try {
      await Promise.all(selectedPendingDelete.map((id) => deleteTag.mutateAsync(id)));
    } catch (error) {
      console.error("Error deleting tag(s):", error);
      toast.error(t("settings.tagManager.deleteError"), TOAST_OPTIONS);
    } finally {
      setSelectedPendingDelete([]);
    }
  };

  const deleteCount = selectedPendingDelete.length;
  const singleTag = deleteCount === 1 ? tags?.find((tag) => tag.id === selectedPendingDelete[0]) : undefined;
  const confirmTitle =
    deleteCount <= 1
      ? t("settings.tagManager.deleteConfirmTitle", { name: singleTag?.name ?? "" })
      : t("settings.tagManager.deleteConfirmTitle_bulk", { count: deleteCount });
  const confirmDescription =
    deleteCount <= 1
      ? t("settings.tagManager.deleteConfirmDescription", { name: singleTag?.name ?? "" })
      : t("settings.tagManager.deleteConfirmDescription_bulk", { count: deleteCount });

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.tagManager")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.tagManager.description")}
        </Typography>
      </Box>

      <EnhancedTable
        rows={rows}
        headCells={headCells}
        tableName={t("nav.tagManager")}
        tableIcon={<LocalOfferIcon color="secondary" />}
        onAddClick={handleAddClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        moveDirection="down"
      />

      <TagDialog
        open={dialogOpen}
        title={dialogTag ? t("settings.tagManager.editDialogTitle") : t("settings.tagManager.addDialogTitle")}
        defaultValues={
          dialogTag ? { name: dialogTag.name, color: dialogTag.color, textColor: dialogTag.textColor } : undefined
        }
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        submitLabel={dialogTag ? t("common.save") : t("common.add")}
      />

      <ConfirmDialog
        open={selectedPendingDelete.length > 0}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setSelectedPendingDelete([])}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default TagManagerPage;
