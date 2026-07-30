import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

interface ScreenshotGalleryProps {
  urls: string[];
  altPrefix: string;
  title?: string;
}

const ScreenshotGallery = ({ urls, altPrefix, title }: ScreenshotGalleryProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {title ?? t("screenshotGallery.title")}
      </Typography>
      <ImageList cols={3} gap={8} sx={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr)) !important" }}>
        {urls.map((url, index) => (
          <ImageListItem key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={t("screenshotGallery.alt", { prefix: altPrefix, index: index + 1 })}
                loading="lazy"
                style={{ width: "100%", borderRadius: 4, display: "block" }}
              />
            </a>
          </ImageListItem>
        ))}
      </ImageList>
    </>
  );
};

export default ScreenshotGallery;
