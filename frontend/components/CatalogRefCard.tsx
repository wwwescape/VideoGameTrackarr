import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

interface CatalogRefCardProps {
  name: string;
  gameCount: number;
  onClick: () => void;
}

// A compact, imageless counterpart to GameCard — for tiles that link out to a whole
// collection/franchise rather than a single game.
const CatalogRefCard = ({ name, gameCount, onClick }: CatalogRefCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

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
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography
            variant="subtitle2"
            component="div"
            title={name}
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{name}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {t(gameCount === 1 ? "catalog.refCard.gameCountSingular" : "catalog.refCard.gameCountPlural", {
              count: gameCount,
            })}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default CatalogRefCard;
