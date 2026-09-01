import { useState } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

interface ScreenshotGalleryProps {
  urls: string[];
  altPrefix: string;
  title?: string;
}

const ScreenshotGallery = ({ urls, altPrefix, title }: ScreenshotGalleryProps) => {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {title ?? t("screenshotGallery.title")}
      </Typography>
      <ImageList
        cols={3}
        gap={8}
        sx={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr)) !important" }}
      >
        {urls.map((url, index) => (
          <ImageListItem key={url}>
            <ButtonBase
              onClick={() => setLightboxIndex(index)}
              aria-label={t("screenshotGallery.openAlt", { prefix: altPrefix, index: index + 1 })}
              sx={{ display: "block", width: "100%", borderRadius: 1 }}
            >
              <img
                src={url}
                alt={t("screenshotGallery.alt", { prefix: altPrefix, index: index + 1 })}
                loading="lazy"
                style={{ width: "100%", borderRadius: 4, display: "block" }}
              />
            </ButtonBase>
          </ImageListItem>
        ))}
      </ImageList>
      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        close={() => setLightboxIndex(null)}
        slides={urls.map((url) => ({ src: url }))}
        plugins={[Thumbnails, Counter, Zoom, Fullscreen]}
      />
    </>
  );
};

export default ScreenshotGallery;
