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
  // Not linked to a hardware reference catalog entry: a "Custom" chip, styled like
  // GameCard's for a game with no IGDB link.
  isCustom?: boolean;
  // An extra line under the subtitle (the release date in the release calendar).
  dateLine?: string;
  // Optional so a read-only context (the public share-link view) can render a non-clickable
  // card without a dummy handler.
  onClick?: () => void;
}

// Shared by Hardware and Accessory grids — same shape of info (name, a one-line
// subtitle, owned/wishlist badges, a quantity) but neither maps cleanly onto
// GameCard's game-specific fields (release year, play status, addon type), so this is
// its own component rather than a GameCard reuse. Photo first: the product shot sits whole
// in a white 4:3 well (shots are on white backgrounds), in light and dark mode.
const HardwareCard = ({
  name,
  subtitle,
  imageUrl,
  owned,
  wishlisted,
  ownedQuantity,
  isCustom = false,
  dateLine,
  onClick,
}: HardwareCardProps) => {
  const { t } = useTranslation();

  return (
    <FlatTile
      name={name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "4 / 3", bgcolor: imageUrl ? "#fff" : "vgt.surface2" }}
      lines={dateLine === undefined ? [subtitle || " "] : [subtitle || " ", dateLine]}
      overlay={
        <>
          <OwnershipBadges owned={owned} wishlisted={wishlisted} />
          {isCustom ? (
            // Bottom-left: the bottom-right corner is the quantity badge's. Colours match
            // GameCard's Custom chip.
            <Box
              component="span"
              sx={{
                position: "absolute",
                left: 7,
                bottom: 7,
                maxWidth: "calc(100% - 64px)",
                height: 22,
                px: 1,
                borderRadius: 999,
                bgcolor: "#5d6673",
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 650,
                lineHeight: "22px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                // The same 1px outer ring as GameCard's chip shadow, as a theme token.
                outline: "1px solid",
                outlineColor: "vgt.glassLine",
                pointerEvents: "none",
              }}
            >
              {t("hardware.card.customLabel")}
            </Box>
          ) : null}
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
