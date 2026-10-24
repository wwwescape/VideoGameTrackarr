import type { ReactNode } from "react";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { Crumb } from "../navigation/breadcrumbConfig";
import { DetailHero, Pill } from "./Detail";
import OwnershipBadges from "./OwnershipBadges";

interface HardwareHeroProps {
  name: string;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  crumbs: Crumb[];
  subline: ReactNode[];
  pills: ReactNode;
}

// Device and accessory pages: the product shot in a light 4:3 well (shots are mostly on white),
// over a blurred copy of itself.
export const HardwareHero = ({ name, imageUrl, owned, wishlisted, crumbs, subline, pills }: HardwareHeroProps) => {
  const { t } = useTranslation();
  const image = resolveAssetUrl(imageUrl);
  return (
    <DetailHero
      backdrop={image ? { url: image, blur: true } : null}
      media={
        <Box
          sx={{
            position: "relative",
            aspectRatio: "4 / 3",
            borderRadius: 2.5,
            overflow: "hidden",
            bgcolor: "#ffffff",
            border: 1,
            borderColor: "vgt.borderStrong",
            boxShadow: "0 18px 40px rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            color: "#7c8593",
          }}
        >
          {image ? (
            <Box component="img" src={image} alt={name} sx={{ width: "100%", height: "100%", objectFit: "contain", p: 1.25 }} />
          ) : (
            <Box sx={{ textAlign: "center", p: 1 }}>
              <ImageNotSupportedOutlinedIcon fontSize="large" />
              <Typography variant="caption" component="div">
                {t("hardware.coverCard.noImageAvailable")}
              </Typography>
            </Box>
          )}
          <OwnershipBadges owned={owned} wishlisted={wishlisted} />
        </Box>
      }
      mediaWidth={{ xs: 150, md: 300 }}
      crumbs={crumbs}
      title={name}
      subline={subline}
      pills={pills}
    />
  );
};

// Linked devices/accessories carry only a name, so they're linked pills rather than tiles.
export const LinkedHardware = ({ items, emptyText }: { items: { key: number; label: string; to: string }[]; emptyText: string }) =>
  items.length === 0 ? (
    <Typography variant="body2" color="text.secondary">
      {emptyText}
    </Typography>
  ) : (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {items.map((item) => (
        <Pill key={item.key} to={item.to}>
          {item.label}
        </Pill>
      ))}
    </Box>
  );
