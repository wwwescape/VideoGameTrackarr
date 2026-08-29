import { Link, useLocation, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";

// Mirrors GamesSubNav.tsx's chip-row pattern — just 2 destinations here, so no need for
// the full responsive nav rail/drawer/bottom-bar the authenticated app uses.
const PublicSubNav = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { t } = useTranslation();

  const items = [
    { to: `/public/${token}/games`, labelKey: "public.nav.games" },
    { to: `/public/${token}/hardware`, labelKey: "public.nav.hardware" },
  ] as const;

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {items.map((item) => {
        const isSelected = location.pathname === item.to;
        return (
          <Chip
            key={item.to}
            component={Link}
            to={item.to}
            label={t(item.labelKey)}
            clickable
            color={isSelected ? "primary" : "default"}
            variant={isSelected ? "filled" : "outlined"}
          />
        );
      })}
    </Box>
  );
};

export default PublicSubNav;
