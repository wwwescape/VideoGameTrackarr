import { useEffect, useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useSetGameRating } from "../hooks/useGames";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { Section, SectionAction } from "./Detail";

interface YourRatingSectionProps {
  gameId: number;
  // Your overall rating, 1-10 stars, or null.
  rating: number | null;
}

// The game page's Your Rating: ten stars for your overall rating of the game (whichever
// platforms you own it on), saved as soon as you pick one. Clear removes it; so does picking
// the current star again.
const YourRatingSection = ({ gameId, rating }: YourRatingSectionProps) => {
  const { t } = useTranslation();
  const setRating = useSetGameRating(gameId);
  // Shown straight away; goes back to the saved rating if saving fails.
  const [value, setValue] = useState(rating);
  useEffect(() => setValue(rating), [rating]);

  const save = async (next: number | null) => {
    setValue(next);
    try {
      await setRating.mutateAsync(next);
    } catch (error) {
      console.error(`Error saving the rating for game ${gameId}:`, error);
      setValue(rating);
      toast.error(t("games.rating.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <Section
      id="rating"
      title={t("games.rating.title")}
      action={
        value !== null ? (
          <SectionAction icon={<ClearIcon />} label={t("games.rating.clear")} onClick={() => void save(null)} />
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Rating
          name={`game-${gameId}-rating`}
          max={10}
          value={value}
          onChange={(_event, next) => void save(next)}
          getLabelText={(stars) => t("games.rating.starsLabel", { count: stars })}
          sx={{ fontSize: { xs: 26, sm: 28 } }}
        />
        <Typography variant="body2" color="text.secondary">
          {value !== null ? t("progress.ratingValue", { rating: value }) : t("progress.unrated")}
        </Typography>
      </Box>
    </Section>
  );
};

export default YourRatingSection;
