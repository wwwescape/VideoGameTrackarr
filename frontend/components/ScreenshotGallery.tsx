import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import Typography from "@mui/material/Typography";

interface ScreenshotGalleryProps {
  urls: string[];
  altPrefix: string;
  title?: string;
}

const ScreenshotGallery = ({ urls, altPrefix, title = "Screenshots" }: ScreenshotGalleryProps) => (
  <>
    <Typography variant="subtitle2" gutterBottom>
      {title}
    </Typography>
    <ImageList cols={3} gap={8} sx={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr)) !important" }}>
      {urls.map((url, index) => (
        <ImageListItem key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={`${altPrefix} screenshot ${index + 1}`}
              loading="lazy"
              style={{ width: "100%", borderRadius: 4, display: "block" }}
            />
          </a>
        </ImageListItem>
      ))}
    </ImageList>
  </>
);

export default ScreenshotGallery;
