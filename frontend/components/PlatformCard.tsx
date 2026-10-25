import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import type { LibraryPlatform } from "../api/types";
import { platformLogoUrl } from "../utils/platformLogos";
import { storefrontLogoUrl, type PlatformScope } from "../utils/platformScope";
import FlatTile from "./FlatTile";

interface PlatformCardProps {
  // name is the card's display name ("PC · Steam" for a PC storefront card).
  platform: LibraryPlatform;
  scope: PlatformScope;
  onClick: () => void;
}

// The platform's logo (from assets/platforms/, see utils/platformLogos.ts) or, until one is
// added, its abbreviation as a text badge. A PC storefront card shows that storefront's logo
// (or its name) instead.
export const PlatformLogo = ({ platform, scope, height }: { platform: LibraryPlatform; scope: PlatformScope; height: number }) => {
  const logoUrl = scope.storefront ? storefrontLogoUrl(scope.storefront) : platformLogoUrl(platform.slug);
  const badgeText = scope.storefront ?? (platform.abbreviation || platform.name);
  return logoUrl ? (
    <Box component="img" src={logoUrl} alt="" sx={{ maxHeight: height, maxWidth: "100%", objectFit: "contain", display: "block" }} />
  ) : (
    <Box
      aria-hidden
      sx={{
        fontWeight: 700,
        fontSize: Math.round(height * 0.36),
        color: "text.secondary",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}
    >
      {badgeText}
    </Box>
  );
};

// CatalogRefCard's sibling for Games → Platforms: the logo in a short well, plus separate
// owned/wishlisted counts.
const PlatformCard = ({ platform, scope, onClick }: PlatformCardProps) => {
  const { t } = useTranslation();
  return (
    <FlatTile
      name={platform.name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "16 / 9", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}
      media={<PlatformLogo platform={platform} scope={scope} height={56} />}
      lines={[
        t("games.platformsPage.ownedCount", { count: platform.ownedCount }),
        t("games.platformsPage.wishlistedCount", { count: platform.wishlistedCount }),
      ]}
    />
  );
};

export default PlatformCard;
