import { useLocation, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { usePublicLabEnabled } from "../hooks/usePublic";
import { ToolbarButton } from "./Page";

// Games, Shelf and Hardware on the share-link pages, as header tabs.
const PublicSubNav = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { t } = useTranslation();

  // The Shelf tab only while the owner has the Game Shelf lab on.
  const { enabled: shelfEnabled } = usePublicLabEnabled(token, "game_shelf");
  const items = [
    { to: `/public/${token}/games`, labelKey: "public.nav.games" },
    ...(shelfEnabled ? [{ to: `/public/${token}/shelf`, labelKey: "public.nav.shelf" }] : []),
    { to: `/public/${token}/hardware`, labelKey: "public.nav.hardware" },
  ];

  return (
    <Box component="nav" aria-label={t("public.nav.label")} sx={{ display: "flex", gap: 0.5 }}>
      {items.map((item) => {
        // Prefix match too, so Games stays selected on a game's own page.
        const isSelected =
          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
        return (
          <ToolbarButton
            key={item.to}
            icon={null}
            label={t(item.labelKey)}
            to={item.to}
            active={isSelected}
            aria-current={isSelected ? "page" : undefined}
            sx={{ height: 34, flexDirection: "row", fontSize: 13 }}
          />
        );
      })}
    </Box>
  );
};

export default PublicSubNav;
