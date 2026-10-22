import Box from "@mui/material/Box";
import AlbumIcon from "@mui/icons-material/Album";
import BoltIcon from "@mui/icons-material/Bolt";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SdCardIcon from "@mui/icons-material/SdCard";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StarIcon from "@mui/icons-material/Star";
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset";
import type { ComponentType } from "react";
import { platformLogoUrl } from "../utils/platformLogos";
import { resolveAssetUrl } from "../api/client";

// The icons a platform's generic spine can wear at its top. "logo" is the
// default: the platform's own logo image when one is bundled, else a gamepad
// glyph. "none" hides the icon entirely.
export const SPINE_ICON_OPTIONS: { key: string; Icon: ComponentType<{ sx?: object }> | null }[] = [
  { key: "logo", Icon: null },
  { key: "gamepad", Icon: SportsEsportsIcon },
  { key: "disc", Icon: AlbumIcon },
  { key: "cartridge", Icon: SdCardIcon },
  { key: "arcade", Icon: VideogameAssetIcon },
  { key: "star", Icon: StarIcon },
  { key: "trophy", Icon: EmojiEventsIcon },
  { key: "heart", Icon: FavoriteIcon },
  { key: "bolt", Icon: BoltIcon },
  { key: "none", Icon: null },
];

export function spineIconGlyph(key: string | null | undefined): ComponentType<{ sx?: object }> {
  const found = SPINE_ICON_OPTIONS.find((option) => option.key === key);
  return found?.Icon ?? SportsEsportsIcon;
}

interface SpineIconGlyphProps {
  iconKey: string | null | undefined;
  slug: string | null | undefined;
  size: number;
  iconUrl?: string | null;
}

export default function SpineIconGlyph({ iconKey, slug, size, iconUrl }: SpineIconGlyphProps) {
  const key = iconKey ?? "logo";
  if (key === "none") return null;
  if (key === "custom" && iconUrl) {
    return (
      <Box
        component="img"
        src={resolveAssetUrl(iconUrl) ?? undefined}
        alt=""
        sx={{ width: size, height: size, objectFit: "contain", display: "block" }}
      />
    );
  }
  if (key === "logo") {
    const logoUrl = platformLogoUrl(slug);
    if (logoUrl) {
      return (
        <Box
          component="img"
          src={logoUrl}
          alt=""
          sx={{ width: size, height: size, objectFit: "contain", display: "block" }}
        />
      );
    }
  }
  const Icon = spineIconGlyph(key === "logo" ? "gamepad" : key);
  return <Icon sx={{ fontSize: size, display: "block" }} />;
}
