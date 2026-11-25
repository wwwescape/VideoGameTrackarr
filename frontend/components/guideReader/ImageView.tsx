import { useState } from "react";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GuideViewProps } from "./types";
import ViewToolbar from "./ViewToolbar";

const STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

// A photo or scan (a receipt, a warranty card, a map): fitted to the window to start with,
// then zoomed in steps (or to its actual size) and scrolled around. Find on page doesn't apply,
// and there's no place to remember.
const ImageView = ({ guide, url, onError }: GuideViewProps) => {
  const { t } = useTranslation();
  // "fit" until you zoom; then a scale of the image's own size.
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [fitScale, setFitScale] = useState(1);

  const current = zoom === "fit" ? fitScale : zoom;
  const step = (direction: 1 | -1) => {
    const next =
      direction === 1
        ? STEPS.find((value) => value > current + 0.001)
        : [...STEPS].reverse().find((value) => value < current - 0.001);
    if (next !== undefined) setZoom(next);
  };

  return (
    <>
      <ViewToolbar>
        <Tooltip title={t("guides.reader.zoomOut")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.zoomOut")}
              disabled={!natural || current <= STEPS[0] + 0.001}
              onClick={() => step(-1)}
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: 48, textAlign: "center" }} aria-live="polite">
          {natural ? `${Math.round(current * 100)}%` : ""}
        </Typography>
        <Tooltip title={t("guides.reader.zoomIn")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.zoomIn")}
              disabled={!natural || current >= STEPS[STEPS.length - 1] - 0.001}
              onClick={() => step(1)}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("guides.reader.fitPage")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.fitPage")}
              disabled={zoom === "fit"}
              onClick={() => setZoom("fit")}
            >
              <FitScreenOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Button size="small" disabled={!natural || zoom === 1} onClick={() => setZoom(1)}>
          {t("guides.reader.actualSize")}
        </Button>
      </ViewToolbar>
      <Box
        data-testid="guide-image"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          bgcolor: "background.default",
          p: zoom === "fit" ? { xs: 1, sm: 2 } : 0,
        }}
      >
        <Box
          component="img"
          src={url}
          alt={guide.name}
          onLoad={(event) => {
            const image = event.currentTarget;
            setNatural({ width: image.naturalWidth, height: image.naturalHeight });
            const box = image.parentElement;
            if (box && image.naturalWidth && image.naturalHeight) {
              setFitScale(
                Math.min(
                  1,
                  box.clientWidth / image.naturalWidth,
                  box.clientHeight / image.naturalHeight
                )
              );
            }
          }}
          onError={() => onError(new Error("The image couldn't be loaded"))}
          sx={
            zoom === "fit" || !natural
              ? { m: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }
              : {
                  m: "auto",
                  flexShrink: 0,
                  width: natural.width * zoom,
                  height: natural.height * zoom,
                  maxWidth: "none",
                }
          }
        />
      </Box>
    </>
  );
};

export default ImageView;
