import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import FlatTile from "./FlatTile";
import OwnershipBadges from "./OwnershipBadges";

interface HardwareCardProps {
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  // Optional so a read-only context (the public share-link view) can render a non-clickable
  // card without a dummy handler.
  onClick?: () => void;
}

// Shared by Hardware and Accessory grids — same shape of info (name, a one-line
// subtitle, owned/wishlist badges, a quantity) but neither maps cleanly onto
// GameCard's game-specific fields (release year, play status, addon type), so this is
// its own component rather than a GameCard reuse. Photo first: the product shot sits whole
// in a white 4:3 well (shots are on white backgrounds), in light and dark mode.
const HardwareCard = ({ name, subtitle, imageUrl, owned, wishlisted, ownedQuantity, onClick }: HardwareCardProps) => {
  const { t } = useTranslation();

  return (
    <FlatTile
      name={name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "4 / 3", bgcolor: imageUrl ? "#fff" : "vgt.surface2" }}
      lines={[subtitle || " "]}
      overlay={
        <>
          <OwnershipBadges owned={owned} wishlisted={wishlisted} />
          {owned && ownedQuantity > 1 ? (
            <Box
              aria-label={t("hardware.card.quantity", { count: ownedQuantity })}
              sx={{
                position: "absolute",
                right: 7,
                bottom: 7,
                px: 0.875,
                height: 22,
                lineHeight: "22px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 650,
                color: "#fff",
                bgcolor: "vgt.glass",
                border: 1,
                borderColor: "vgt.glassLine",
                backdropFilter: "blur(4px)",
              }}
            >
              ×{ownedQuantity}
            </Box>
          ) : null}
        </>
      }
      media={
        imageUrl ? (
          <Box
            component="img"
            alt={name}
            src={resolveAssetUrl(imageUrl) ?? undefined}
            loading="lazy"
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", p: 1.5, boxSizing: "border-box" }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              color: "vgt.text3",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              textAlign: "center",
            }}
          >
            {t("hardware.card.noImage")}
          </Box>
        )
      }
    />
  );
};

export default HardwareCard;
