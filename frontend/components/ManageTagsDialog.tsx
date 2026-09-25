import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import DeleteIcon from "@mui/icons-material/Delete";
import LabelIcon from "@mui/icons-material/Label";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useBulkUpdateGameTags, useCreateTag, useTagCoverage } from "../hooks/useTags";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import TagChip from "./TagChip";

type ManageTagsTab = "add" | "remove";

interface ManageTagsDialogProps {
  open: boolean;
  gameIds: number[];
  onClose: () => void;
}

// Two independent checklists (Add/Remove), each showing the full tag vocabulary with an
// informational "X of N games" coverage count — deliberately simpler than an earlier
// tri-state-checkbox design that folded both directions into one table; see TODOS.md for why
// that was dropped in favor of this mockup-driven shape.
const ManageTagsDialog = ({ open, gameIds, onClose }: ManageTagsDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ManageTagsTab>("add");
  const [search, setSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [addChecked, setAddChecked] = useState<Set<number>>(new Set());
  const [removeChecked, setRemoveChecked] = useState<Set<number>>(new Set());

  const { data: coverage = [], isLoading } = useTagCoverage(gameIds, open);
  const createTag = useCreateTag();
  const bulkUpdate = useBulkUpdateGameTags();

  // Fresh state every time the dialog is (re-)opened for a new selection — carrying over a
  // previous selection's checked tags into an unrelated one would be a real footgun.
  useEffect(() => {
    if (open) {
      setTab("add");
      setSearch("");
      setNewTagName("");
      setAddChecked(new Set());
      setRemoveChecked(new Set());
    }
  }, [open]);

  const filteredCoverage = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return coverage;
    return coverage.filter((tagCoverage) => tagCoverage.name.toLowerCase().includes(query));
  }, [coverage, search]);

  const checked = tab === "add" ? addChecked : removeChecked;
  const setChecked = tab === "add" ? setAddChecked : setRemoveChecked;

  const toggleTag = (tagId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // Add always applies to every selected game; Remove's real effect is the union of games
  // covered by whichever tags are checked, which can be fewer than every selected game (and
  // is not just the sum of each tag's own count, since games can carry more than one of the
  // checked tags at once).
  const affectedGameCount = useMemo(() => {
    if (tab === "add") return gameIds.length;
    const affected = new Set<number>();
    for (const tagCoverage of coverage) {
      if (removeChecked.has(tagCoverage.id)) {
        for (const gameId of tagCoverage.gameIds) affected.add(gameId);
      }
    }
    return affected.size;
  }, [tab, coverage, removeChecked, gameIds.length]);

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync({ name });
      setAddChecked((prev) => new Set(prev).add(tag.id));
      setNewTagName("");
      // useCreateTag only invalidates ["tags"] (the Tag Manager's own list) — this dialog
      // reads from the separate ["tagCoverage", gameIds] cache, which needs its own refetch
      // so the brand-new tag actually shows up in the checklist above.
      await queryClient.invalidateQueries({ queryKey: ["tagCoverage"] });
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error(t("dialogs.manageTags.createTagError"), TOAST_OPTIONS);
    }
  };

  const handleSubmit = async () => {
    try {
      if (tab === "add") {
        await bulkUpdate.mutateAsync({ gameIds, addTagIds: Array.from(addChecked) });
        toast.success(
          t("dialogs.manageTags.addSuccessToast", { count: gameIds.length }),
          TOAST_OPTIONS
        );
      } else {
        await bulkUpdate.mutateAsync({ gameIds, removeTagIds: Array.from(removeChecked) });
        toast.success(
          t("dialogs.manageTags.removeSuccessToast", { count: affectedGameCount }),
          TOAST_OPTIONS
        );
      }
      onClose();
    } catch (error) {
      console.error("Error applying tag changes:", error);
      toast.error(t("dialogs.manageTags.applyError"), TOAST_OPTIONS);
    }
  };

  const isSubmitDisabled = checked.size === 0 || bulkUpdate.isPending;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("dialogs.manageTags.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("dialogs.manageTags.subtitle", { count: gameIds.length })}
        </Typography>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab value="add" label={t("dialogs.manageTags.addTabLabel")} />
          <Tab value="remove" label={t("dialogs.manageTags.removeTabLabel")} />
        </Tabs>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {tab === "add"
            ? t("dialogs.manageTags.addDescription")
            : t("dialogs.manageTags.removeDescription")}
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("dialogs.manageTags.searchPlaceholder")}
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ maxHeight: 420, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
          {isLoading ? (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("common.loading")}
              </Typography>
            </Box>
          ) : filteredCoverage.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("dialogs.manageTags.noTagsFound")}
              </Typography>
            </Box>
          ) : (
            filteredCoverage.map((tagCoverage) => (
              <Stack
                key={tagCoverage.id}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  px: 1,
                  py: 0.5,
                  "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
                }}
              >
                <Checkbox
                  checked={checked.has(tagCoverage.id)}
                  onChange={() => toggleTag(tagCoverage.id)}
                  size="small"
                  slotProps={{ input: { "aria-label": tagCoverage.name } }}
                />
                <TagChip tag={tagCoverage} size="small" />
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {t("dialogs.manageTags.tagCoverageLabel", {
                    count: tagCoverage.gameIds.length,
                    total: gameIds.length,
                  })}
                </Typography>
              </Stack>
            ))
          )}
        </Box>
        {tab === "add" ? (
          <TextField
            fullWidth
            size="small"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCreateTag();
              }
            }}
            disabled={createTag.isPending}
            placeholder={t("dialogs.manageTags.createTagPlaceholder")}
            helperText={t("dialogs.manageTags.createTagHelperText")}
            sx={{ mt: 2 }}
          />
        ) : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
        <Box>
          <Typography variant="body2">
            {t("dialogs.manageTags.tagsSelectedCount", { count: checked.size })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tab === "add"
              ? t("dialogs.manageTags.addFooterHint", { count: gameIds.length })
              : t("dialogs.manageTags.removeFooterHint", { count: affectedGameCount })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            color={tab === "remove" ? "error" : "primary"}
            startIcon={tab === "add" ? <LabelIcon /> : <DeleteIcon />}
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {tab === "add"
              ? t("dialogs.manageTags.addSubmitButton", { count: gameIds.length })
              : t("dialogs.manageTags.removeSubmitButton", { count: affectedGameCount })}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default ManageTagsDialog;
