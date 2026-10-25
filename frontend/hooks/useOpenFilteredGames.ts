import { useNavigate } from "react-router-dom";
import { presetGameListFilters, type GameListPreset } from "./useGameListState";

// Opens the Games list with just this filter set, replacing the session's remembered filters
// (Overview's Now playing and Needs attention, Insights' breakdown rows).
export function useOpenFilteredGames() {
  const navigate = useNavigate();
  return (preset: GameListPreset) => {
    presetGameListFilters("games", preset);
    navigate("/games");
  };
}
