import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ToysToLifeGameSection } from "../api/types";
import { packTypeLabel, toyPath } from "../utils/toysToLife";
import { Section, SectionAction } from "./Detail";
import HardwareCard from "./HardwareCard";

// The game page's Toys to Life section, in place of Addons on a line's base game (LEGO
// Dimensions): its packs as a grid like the Addons one, each opening its own page. Only the
// starter kits for the platforms you own the game on are in it; "All packs" opens the line's
// page with every one.
const ToysToLifeSection = ({ section }: { section: ToysToLifeGameSection }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Section
      id="toys-to-life"
      title={t("nav.toysToLife")}
      action={<SectionAction icon={<ArrowForwardIcon />} label={t("toysToLife.allPacks")} to={`/toys-to-life/${section.line}`} />}
    >
      {section.items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("toysToLife.linePage.emptyMessage")}
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fill, minmax(150px, 1fr))" },
            gap: "18px 14px",
          }}
        >
          {section.items.map((item) => (
            <HardwareCard
              key={item.id}
              name={item.name}
              subtitle={`${packTypeLabel(item.packType, t)} · ${item.setNumber}`}
              imageUrl={item.imageUrl}
              owned={item.owned}
              wishlisted={item.wishlisted}
              ownedQuantity={0}
              onClick={() => navigate(toyPath(item))}
            />
          ))}
        </Box>
      )}
    </Section>
  );
};

export default ToysToLifeSection;
