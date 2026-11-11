import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import type { ManualGameVideoInput } from "../api/types";
import { useUploadGameMedia } from "../hooks/useUploads";
import { useImageUploadHint } from "./ImageUploadHint";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "../utils/youtube";

// Mirrors the backend's manual_game_service.MAX_MEDIA_PER_KIND.
export const MAX_MEDIA_PER_KIND = 10;

export interface GameMediaValue {
  screenshotUrls: string[];
  artworkUrls: string[];
  videos: ManualGameVideoInput[];
}

export const EMPTY_GAME_MEDIA: GameMediaValue = { screenshotUrls: [], artworkUrls: [], videos: [] };

// One removable thumbnail, 16:9 like the galleries on the game page.
const Thumbnail = ({ src, alt, removeLabel, onRemove }: { src: string; alt: string; removeLabel: string; onRemove: () => void }) => (
  <Box sx={{ position: "relative", width: 128, aspectRatio: "16 / 9", flexShrink: 0 }}>
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 1, border: 1, borderColor: "divider", display: "block" }}
    />
    <IconButton
      size="small"
      aria-label={removeLabel}
      onClick={onRemove}
      sx={{ position: "absolute", top: 2, right: 2, p: 0.25, bgcolor: "rgba(0,0,0,.6)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,.8)" } }}
    >
      <CloseIcon sx={{ fontSize: 16 }} />
    </IconButton>
  </Box>
);

const SectionHeader = ({ title, count, helper, action }: { title: string; count: number; helper?: string; action: React.ReactNode }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, mb: 1 }}>
    <Typography variant="subtitle2">
      {title}{" "}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
        {count} / {MAX_MEDIA_PER_KIND}
      </Box>
    </Typography>
    {action}
    {helper ? (
      <Typography variant="caption" sx={{ color: "text.secondary", flexBasis: "100%" }}>
        {helper}
      </Typography>
    ) : null}
  </Stack>
);

interface ImageSectionProps {
  title: string;
  helper?: string;
  urls: string[];
  // Updaters rather than a new list: an upload finishing must add to the list as it is then,
  // after any removal or other upload in the meantime.
  onChange: (update: (urls: string[]) => string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}

const ImageSection = ({ title, helper, urls, onChange, onUploadingChange }: ImageSectionProps) => {
  const { t } = useTranslation();
  const upload = useUploadGameMedia();
  const [uploading, setUploading] = useState(false);
  const free = Math.max(0, MAX_MEDIA_PER_KIND - urls.length);

  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > free) {
      toast.info(t("games.gameForm.media.tooManyFiles", { count: free }), TOAST_OPTIONS);
    }
    setUploading(true);
    // One at a time, in the order picked, so the list keeps that order.
    for (const file of files.slice(0, free)) {
      try {
        const { url } = await upload.mutateAsync(file);
        onChange((current) => (current.length < MAX_MEDIA_PER_KIND ? [...current, url] : current));
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error(t("games.gameForm.media.uploadError", { name: file.name }), TOAST_OPTIONS);
      }
    }
    setUploading(false);
  };

  return (
    <Box>
      <SectionHeader
        title={title}
        count={urls.length}
        helper={helper}
        action={
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={14} /> : <CloudUploadIcon />}
            disabled={uploading || free === 0}
          >
            {t("games.gameForm.media.addImagesButton")}
            <input type="file" accept="image/*" multiple hidden onChange={(event) => void handleFiles(event)} />
          </Button>
        }
      />
      {urls.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {urls.map((url, index) => (
            <Thumbnail
              key={url}
              src={resolveAssetUrl(url) ?? url}
              alt={t("games.gameForm.media.imageAlt", { title, index: index + 1 })}
              removeLabel={t("games.gameForm.media.removeImageAriaLabel", { index: index + 1 })}
              onRemove={() => onChange((current) => current.filter((other) => other !== url))}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
};

interface VideoSectionProps {
  videos: ManualGameVideoInput[];
  onChange: (videos: ManualGameVideoInput[]) => void;
}

const VideoSection = ({ videos, onChange }: VideoSectionProps) => {
  const { t } = useTranslation();
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = videos.length >= MAX_MEDIA_PER_KIND;

  const handleAdd = () => {
    const videoId = parseYoutubeVideoId(link);
    if (!videoId) {
      setError(t("games.gameForm.media.invalidVideoLink"));
      return;
    }
    if (videos.some((video) => video.videoId === videoId)) {
      setError(t("games.gameForm.media.duplicateVideo"));
      return;
    }
    onChange([...videos, { name: title.trim() || null, videoId }]);
    setLink("");
    setTitle("");
    setError(null);
  };

  return (
    <Box>
      <SectionHeader title={t("games.about.videosTitle")} count={videos.length} helper={t("games.gameForm.media.videosHelperText")} action={null} />
      {videos.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}>
          {videos.map((video, index) => (
            <Box key={video.videoId} sx={{ width: 128 }}>
              <Thumbnail
                src={youtubeThumbnailUrl(video.videoId)}
                alt={video.name ?? t("games.about.watchOnYoutube")}
                removeLabel={t("games.gameForm.media.removeVideoAriaLabel", { index: index + 1 })}
                onRemove={() => onChange(videos.filter((other) => other.videoId !== video.videoId))}
              />
              <Typography variant="caption" noWrap title={video.name ?? undefined} sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>
                {video.name ?? t("games.gameForm.media.untitledVideo")}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
      <Grid container spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            size="small"
            fullWidth
            label={t("games.gameForm.media.videoLinkLabel")}
            placeholder="https://www.youtube.com/watch?v=…"
            value={link}
            disabled={full}
            error={Boolean(error)}
            helperText={error ?? undefined}
            onChange={(event) => {
              setLink(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            size="small"
            fullWidth
            label={t("games.gameForm.media.videoTitleLabel")}
            value={title}
            disabled={full}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={full || !link.trim()} sx={{ height: 40 }} fullWidth>
            {t("games.gameForm.media.addVideoButton")}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

interface GameMediaFieldsProps {
  value: GameMediaValue;
  // A state setter's updater form (see ImageSectionProps.onChange).
  onChange: (update: (value: GameMediaValue) => GameMediaValue) => void;
  // True while images are uploading, so the form can wait before saving.
  onUploadingChange: (uploading: boolean) => void;
}

// A custom game's Screenshots, Artwork (the first is the page's background) and YouTube
// Videos, up to MAX_MEDIA_PER_KIND each, on the Add and Edit custom game forms.
const GameMediaFields = ({ value, onChange, onUploadingChange }: GameMediaFieldsProps) => {
  const { t } = useTranslation();
  const mediaHint = useImageUploadHint("media");
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);

  useEffect(() => onUploadingChange(uploadingScreenshots || uploadingArtwork), [uploadingScreenshots, uploadingArtwork, onUploadingChange]);

  return (
    <Stack spacing={2.5}>
      <ImageSection
        title={t("screenshotGallery.title")}
        helper={mediaHint}
        urls={value.screenshotUrls}
        onChange={(update) => onChange((current) => ({ ...current, screenshotUrls: update(current.screenshotUrls) }))}
        onUploadingChange={setUploadingScreenshots}
      />
      <ImageSection
        title={t("games.about.artworkTitle")}
        helper={`${t("games.gameForm.media.artworkHelperText")} ${mediaHint}`}
        urls={value.artworkUrls}
        onChange={(update) => onChange((current) => ({ ...current, artworkUrls: update(current.artworkUrls) }))}
        onUploadingChange={setUploadingArtwork}
      />
      <VideoSection videos={value.videos} onChange={(videos) => onChange((current) => ({ ...current, videos }))} />
    </Stack>
  );
};

export default GameMediaFields;
