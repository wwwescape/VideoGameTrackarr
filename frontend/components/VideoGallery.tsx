import { useState } from "react";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameVideo } from "../api/types";
import VideoDialog from "./VideoDialog";

interface VideoGalleryProps {
  videos: GameVideo[];
}

function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

const VideoGallery = ({ videos }: VideoGalleryProps) => {
  const { t } = useTranslation();
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);

  if (videos.length === 0) return null;

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {t("games.about.videosTitle")}
      </Typography>
      <ImageList
        cols={3}
        gap={8}
        sx={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr)) !important" }}
      >
        {videos.map((video, index) => (
          <ImageListItem key={video.id}>
            <ButtonBase
              onClick={() => setDialogIndex(index)}
              aria-label={t("videoGallery.playAlt", {
                title: video.name ?? t("games.about.watchOnYoutube"),
              })}
              sx={{ display: "block", width: "100%", position: "relative", borderRadius: 1 }}
            >
              <img
                src={youtubeThumbnailUrl(video.videoId)}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  borderRadius: 4,
                  display: "block",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(0, 0, 0, 0.15)",
                }}
              >
                <PlayCircleIcon
                  sx={{
                    fontSize: 48,
                    color: "common.white",
                    filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))",
                  }}
                />
              </Box>
            </ButtonBase>
            <ImageListItemBar title={video.name ?? t("games.about.watchOnYoutube")} />
          </ImageListItem>
        ))}
      </ImageList>
      <VideoDialog
        open={dialogIndex !== null}
        videos={videos}
        index={dialogIndex ?? 0}
        onIndexChange={setDialogIndex}
        onClose={() => setDialogIndex(null)}
      />
    </>
  );
};

export default VideoGallery;
