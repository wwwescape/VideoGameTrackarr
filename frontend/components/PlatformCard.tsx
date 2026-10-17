import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { LibraryPlatform } from "../api/types";
import { platformLogoUrl } from "../utils/platformLogos";
import { storefrontLogoUrl, type PlatformScope } from "../utils/platformScope";

const LOGO_HEIGHT = 56;

interface PlatformCardProps {
  // name is the card's display name ("PC · Steam" for a PC storefront card).
  platform: LibraryPlatform;
  scope: PlatformScope;
  onClick: () => void;
}

// CatalogRefCard's sibling for Games → Platforms: the platform's logo (from
// assets/platforms/, see utils/platformLogos.ts) or, until one is added, its abbreviation as a
// text badge, plus separate owned/wishlisted counts. A PC storefront card shows that
// storefront's logo (or its name) instead.
const PlatformCard = ({ platform, scope, onClick }: PlatformCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const logoUrl = scope.storefront ? storefrontLogoUrl(scope.storefront) : platformLogoUrl(platform.slug);
  const badgeText = scope.storefront ?? (platform.abbreviation || platform.name);

  return (
    <Card
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: theme.shadows[6] },
      }}
    >
      <CardActionArea onClick={onClick}>
        <Box
          sx={{
            height: LOGO_HEIGHT + 16,
            px: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
          }}
        >
          {logoUrl ? (
            <Box
              component="img"
              src={logoUrl}
              alt=""
              sx={{ maxHeight: LOGO_HEIGHT, maxWidth: "100%", objectFit: "contain" }}
            />
          ) : (
            <Typography
              aria-hidden
              variant="h6"
              component="div"
              color="text.secondary"
              sx={{
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {badgeText}
            </Typography>
          )}
        </Box>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography
            variant="subtitle2"
            component="div"
            title={platform.name}
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{platform.name}</strong>
          </Typography>
          {/* Always both lines, so every card is the same height (VirtualGameGrid measures one
              card and assumes the rest match). */}
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {t("games.platformsPage.ownedCount", { count: platform.ownedCount })}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {t("games.platformsPage.wishlistedCount", { count: platform.wishlistedCount })}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default PlatformCard;
