import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { toast } from "react-toastify";
import type { Tag } from "../api/types";
import { useCreateTag, useTags } from "../hooks/useTags";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface TagsSectionProps {
  tags: Tag[];
  onAttach: (tagId: number) => Promise<unknown>;
  onDetach: (tagId: number) => Promise<unknown>;
  subheader?: string;
}

// Entity-agnostic — the parent owns how attach/detach are scoped (to a game, a device, ...).
// Tag creation isn't entity-specific, so this still calls useCreateTag() directly.
const TagsSection = ({
  tags,
  onAttach,
  onDetach,
  subheader = "Organize your own way — co-op, speedrun, backlog priority, whatever fits",
}: TagsSectionProps) => {
  const { data: allTags } = useTags();
  const createTag = useCreateTag();
  const [inputValue, setInputValue] = useState("");

  const attachedIds = new Set(tags.map((tag) => tag.id));
  const options = (allTags ?? []).filter((tag) => !attachedIds.has(tag.id));

  const handleSelect = async (tag: Tag) => {
    try {
      await onAttach(tag.id);
    } catch (error) {
      console.error("Error attaching tag:", error);
      toast.error("Error attaching tag. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleCreateAndAttach = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const tag = await createTag.mutateAsync({ name: trimmed });
      await onAttach(tag.id);
      setInputValue("");
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Error creating tag. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleDetach = async (tagId: number) => {
    try {
      await onDetach(tagId);
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error("Error removing tag. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <>
      <CardHeader title="Tags" subheader={subheader} />
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {tags.length === 0 ? null : tags.map((tag) => (
              <Chip key={tag.id} label={tag.name} onDelete={() => handleDetach(tag.id)} />
            ))}
          </Stack>
          <Autocomplete
            freeSolo
            options={options}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
            inputValue={inputValue}
            onInputChange={(_event, value) => setInputValue(value)}
            onChange={(_event, value) => {
              if (!value) return;
              if (typeof value === "string") {
                void handleCreateAndAttach(value);
              } else {
                void handleSelect(value);
              }
            }}
            renderInput={(params) => <TextField {...params} label="Add a tag" placeholder="Type to search or create" />}
            sx={{ maxWidth: 360 }}
          />
        </Stack>
      </CardContent>
    </>
  );
};

export default TagsSection;
