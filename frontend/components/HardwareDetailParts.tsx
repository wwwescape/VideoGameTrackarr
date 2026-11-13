import type { ReactNode } from "react";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "../api/client";
import type { LinkedHardware as LinkedHardwareItem } from "../api/types";
import type { Crumb } from "../navigation/breadcrumbConfig";
import { DetailHero } from "./Detail";
import HardwareCard from "./HardwareCard";
import OwnershipBadges from "./OwnershipBadges";
import { hardwareIdentifier } from "../utils/identifiers";

interface HardwareHeroProps {
  name: string;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  crumbs: Crumb[];
  subline: ReactNode[];
  pills: ReactNode;
  // External links (a Toys-to-Life pack's IGDB page), on their own row under the pills.
  links?: ReactNode;
}

// Device and accessory pages: the product shot in a light 4:3 well (shots are mostly on white),
// over a blurred copy of itself.
export const HardwareHero = ({ name, imageUrl, owned, wishlisted, crumbs, subline, pills, links }: HardwareHeroProps) => {
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
            // Absolutely filled and border-box, as HardwareCard does: in-flow, the padding made
            // the 100% box overflow the well and the image's natural height stretched the grid
            // row, so the photo sat off-centre and cropped instead of whole and centred.
            <Box
              component="img"
              src={image}
              alt={name}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", p: 1.25, boxSizing: "border-box" }}
            />
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
      links={links}
    />
  );
};

// Linked devices/accessories carry only a name, so they're linked pills rather than tiles.
// Linked Devices / Linked Accessories on a hardware page: the same cards as the Hardware page,
// wrapping like the game page's Add-ons (two columns on phones, then as many as fit).
export const LinkedHardware = ({
  items,
  kind,
  emptyText,
}: {
  items: LinkedHardwareItem[];
  kind: "device" | "accessory";
  emptyText: string;
}) => {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fill, minmax(150px, 1fr))" },
        gap: "18px 14px",
      }}
    >
      {items.map((item) => (
        <HardwareCard
          key={item.id}
          name={item.officialName}
          subtitle={[item.manufacturerName, item.detail].filter(Boolean).join(" · ")}
          imageUrl={item.imageUrl}
          owned={item.owned}
          wishlisted={item.wishlisted}
          isCustom={item.isCustom}
          onClick={() => navigate(`/hardware/${kind}/${hardwareIdentifier(item.officialName, item.uuid)}`)}
        />
      ))}
    </Box>
  );
};
