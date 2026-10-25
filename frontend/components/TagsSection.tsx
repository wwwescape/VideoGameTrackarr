import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Autocomplete, {
  type AutocompleteChangeDetails,
  type AutocompleteChangeReason,
} from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { Tag } from "../api/types";
import { useCreateTag, useTags } from "../hooks/useTags";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { Section, SectionAction } from "./Detail";
import TagChip from "./TagChip";

interface TagsSectionProps {
  tags: Tag[];
  onAttach: (tagId: number) => Promise<unknown>;
  onDetach: (tagId: number) => Promise<unknown>;
}

// A detail page's Tags section: the item's tags as chips in one field that also adds them
// (pick one, or type a new name to create it), with Manage opening the Tag Manager.
// Entity-agnostic — the parent owns how attach/detach are scoped (to a game, a device, ...).
// Tag creation isn't entity-specific, so this still calls useCreateTag() directly.
const TagsSection = ({ tags, onAttach, onDetach }: TagsSectionProps) => {
  const { t } = useTranslation();
  const { data: allTags } = useTags();
  const createTag = useCreateTag();

  const attachedIds = new Set(tags.map((tag) => tag.id));
  const options = (allTags ?? []).filter((tag) => !attachedIds.has(tag.id));

  const handleSelect = async (tag: Tag) => {
    try {
      await onAttach(tag.id);
    } catch (error) {
      console.error("Error attaching tag:", error);
      toast.error(t("tags.attachError"), TOAST_OPTIONS);
    }
  };

  const handleCreateAndAttach = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const tag = await createTag.mutateAsync({ name: trimmed });
      await onAttach(tag.id);
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error(t("tags.createError"), TOAST_OPTIONS);
    }
  };

  const handleDetach = async (tagId: number) => {
    try {
      await onDetach(tagId);
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error(t("tags.detachError"), TOAST_OPTIONS);
    }
  };

  const handleChange = (
    _event: React.SyntheticEvent,
    _value: (Tag | string)[],
    reason: AutocompleteChangeReason,
    details?: AutocompleteChangeDetails<Tag>
  ) => {
    if (!details) return;
    if (reason === "selectOption") {
      void handleSelect(details.option);
    } else if (reason === "createOption") {
      // MUI types `details.option` as `Tag` here too, but for freeSolo createOption it's
      // actually the raw typed string at runtime — the type is simply wrong for this case.
      void handleCreateAndAttach(details.option as unknown as string);
    } else if (reason === "removeOption") {
      void handleDetach(details.option.id);
    }
  };

  return (
    <Section
      id="tags"
      title={t("tags.title")}
      action={
        <SectionAction icon={<EditOutlinedIcon />} label={t("tags.manage")} to="/settings/tags" />
      }
    >
      <Autocomplete
        multiple
        freeSolo
        disableClearable
        size="small"
        disabled={createTag.isPending}
        options={options}
        value={tags}
        getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
        isOptionEqualToValue={(option, value) => option.id === (value as Tag).id}
        onChange={handleChange}
        renderValue={(value, getItemProps) =>
          value.map((option, index) => {
            if (typeof option === "string") return null;
            const { key, ...itemProps } = getItemProps({ index });
            return <TagChip key={key} tag={option} {...itemProps} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={tags.length ? t("tags.addMorePlaceholder") : t("tags.searchPlaceholder")}
            slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, "aria-label": t("tags.addLabel") } }}
          />
        )}
      />
    </Section>
  );
};

export default TagsSection;
