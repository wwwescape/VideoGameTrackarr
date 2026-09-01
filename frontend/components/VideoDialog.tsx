import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { GameVideo } from "../api/types";

interface VideoDialogProps {
  open: boolean;
  videos: GameVideo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

// A dedicated dialog rather than a lightbox slide — embedding a YouTube iframe as a
// swipeable/keyboard-navigable lightbox slide is a documented rough edge upstream
// (iframes capture focus/pointer events, breaking arrow-key and swipe navigation). Plain
// click-driven Previous/Next buttons sidestep that entirely.
const VideoDialog = ({ open, videos, index, onIndexChange, onClose }: VideoDialogProps) => {
  const { t } = useTranslation();
  const video = videos[index];
  const hasMultiple = videos.length > 1;

  if (!video) return null;

  const goToPrevious = () => onIndexChange((index - 1 + videos.length) % videos.length);
  const goToNext = () => onIndexChange((index + 1) % videos.length);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        {video.name ?? t("games.about.watchOnYoutube")}
        <IconButton
          onClick={onClose}
          aria-label={t("common.close")}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
          {hasMultiple ? (
            <Tooltip title={t("videoGallery.previousVideo")}>
              <IconButton
                onClick={goToPrevious}
                aria-label={t("videoGallery.previousVideo")}
                sx={{
                  position: "absolute",
                  left: 8,
                  zIndex: 1,
                  bgcolor: "rgba(0, 0, 0, 0.5)",
                  color: "common.white",
                  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.7)" },
                }}
              >
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              bgcolor: "common.black",
            }}
          >
            <Box
              component="iframe"
              key={video.id}
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1`}
              title={video.name ?? t("games.about.watchOnYoutube")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </Box>
          {hasMultiple ? (
            <Tooltip title={t("videoGallery.nextVideo")}>
              <IconButton
                onClick={goToNext}
                aria-label={t("videoGallery.nextVideo")}
                sx={{
                  position: "absolute",
                  right: 8,
                  zIndex: 1,
                  bgcolor: "rgba(0, 0, 0, 0.5)",
                  color: "common.white",
                  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.7)" },
                }}
              >
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default VideoDialog;
