import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

// The recommended size for each kind of image upload. The numbers mirror the targets in
// backend/app/services/upload_service.py (COVER_TARGET_SIZE, ACCESSORY_TARGET_SIZE,
// GAME_MEDIA_MAX_SIZE, MAX_IMAGE_UPLOAD_BYTES); change them together.
export type ImageUploadKind = "cover" | "accessory" | "media";

export function useImageUploadHint(kind: ImageUploadKind): string {
  const { t } = useTranslation();
  return t(`uploads.hint.${kind}`);
}

const ImageUploadHint = ({ kind, sx }: { kind: ImageUploadKind; sx?: SxProps<Theme> }) => {
  const hint = useImageUploadHint(kind);
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", ...sx }}>
      {hint}
    </Typography>
  );
};

export default ImageUploadHint;
