import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

interface FlatTileProps {
  name: string;
  onClick?: () => void;
  // The picture area (covers, a logo, a photo); the well's frame and shape come from here.
  media: ReactNode;
  mediaSx?: SxProps<Theme>;
  // Small lines under the name (a count, dates). Every tile in a grid should pass the same
  // number, so the cards stay one height (VirtualGameGrid measures one and assumes the rest
  // match).
  lines?: ReactNode[];
  // Overlaid on the picture (badges, a quantity).
  overlay?: ReactNode;
}

// GameCard's flat look for the other cards: an outlined picture well with the name and a line
// or two of detail under it, not a raised card. The whole tile is the link, as the cards were.
const FlatTile = ({ name, onClick, media, mediaSx, lines = [], overlay }: FlatTileProps) => (
  <Box
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={onClick ? name : undefined}
    onClick={onClick}
    onKeyDown={(event) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick();
      }
    }}
    sx={{
      width: "100%",
      cursor: onClick ? "pointer" : "default",
      outline: "none",
      "&:hover .vgt-tile-media": onClick ? { outlineColor: "vgt.borderStrong" } : undefined,
      "&:focus-visible .vgt-tile-media": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
    }}
  >
    <Box
      className="vgt-tile-media"
      sx={[
        {
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          bgcolor: "vgt.surface2",
          outline: "1px solid",
          outlineColor: "divider",
          outlineOffset: "-1px",
          transition: "outline-color 120ms ease",
        },
        ...(Array.isArray(mediaSx) ? mediaSx : [mediaSx]),
      ]}
    >
      {media}
      {overlay}
    </Box>
    <Box sx={{ pt: 1 }}>
      <Box
        title={name}
        sx={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {name}
      </Box>
      {lines.map((line, index) => (
        <Box
          key={index}
          sx={{ color: "vgt.text3", fontSize: 12, minHeight: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {line}
        </Box>
      ))}
    </Box>
  </Box>
);

export default FlatTile;
