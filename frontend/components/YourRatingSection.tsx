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

interface RatingSectionProps {
  // The stars' form name, unique on the page ("game-12-rating").
  name: string;
  // Your overall rating, 1-10 stars, or null.
  rating: number | null;
  onSave: (rating: number | null) => Promise<unknown>;
}

// A detail page's Your Rating: ten stars, saved as soon as you pick one. Clear removes it; so
// does picking the current star again. Entity-agnostic, like TagsSection: the page owns what
// saving means (a game's rating, a Toys-to-Life pack's).
export const RatingSection = ({ name, rating, onSave }: RatingSectionProps) => {
  const { t } = useTranslation();
  // Shown straight away; goes back to the saved rating if saving fails.
  const [value, setValue] = useState(rating);
  useEffect(() => setValue(rating), [rating]);

  const save = async (next: number | null) => {
    setValue(next);
    try {
      await onSave(next);
    } catch (error) {
      console.error(`Error saving the rating ${name}:`, error);
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
          name={name}
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

interface YourRatingSectionProps {
  gameId: number;
  rating: number | null;
}

// The game page's Your Rating: your overall rating of the game, whichever platforms you own it on.
const YourRatingSection = ({ gameId, rating }: YourRatingSectionProps) => {
  const setRating = useSetGameRating(gameId);
  return <RatingSection name={`game-${gameId}-rating`} rating={rating} onSave={(next) => setRating.mutateAsync(next)} />;
};

export default YourRatingSection;
