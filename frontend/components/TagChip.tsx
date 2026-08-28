import { alpha } from "@mui/material/styles";
import Chip, { type ChipProps } from "@mui/material/Chip";
import type { Tag } from "../api/types";

interface TagChipProps extends Omit<ChipProps, "label"> {
  tag: Tag;
}

// Shared everywhere a tag renders as a Chip, so a tag's custom color/textColor (set in Tag
// Manager) shows up consistently rather than only in the page that set it. Chip's own
// deleteIcon does NOT inherit a custom color/bgcolor sx override (it's hardcoded to
// alpha(text.primary, 0.26) unless using MUI's palette-key `color` prop, which arbitrary hex
// values can't use) — the explicit .MuiChip-deleteIcon override below is required, not
// redundant, to keep the "x" legible against a custom background.
const TagChip = ({ tag, sx, ...chipProps }: TagChipProps) => (
  <Chip
    label={tag.name}
    sx={[
      tag.color ? { bgcolor: tag.color } : {},
      tag.textColor
        ? {
            color: tag.textColor,
            "& .MuiChip-deleteIcon": {
              color: alpha(tag.textColor, 0.7),
              "&:hover": { color: tag.textColor },
            },
          }
        : {},
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
    {...chipProps}
  />
);

export default TagChip;
