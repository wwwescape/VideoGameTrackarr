import Box from "@mui/material/Box";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import type { GameSummary } from "../api/types";
import GameCard from "./GameCard";
import VirtualGameGrid from "./VirtualGameGrid";

interface GameAddonsSectionProps {
  addons: GameSummary[] | undefined;
  onAddonClick: (addon: GameSummary) => void;
}

// IGDB's category is a much broader catalog of "things linked under a parent game" than what
// this section should show — bundles/standalone expansions/mods/seasons/etc. all carry parent_game
// too. Every child stays in the database regardless of category (resync still imports all of
// them), this just narrows what the Addons section displays to actual DLC/expansions/packs. Backend
// now classifies via IGDB's `game_type` field (see game_service.py), which is reliably
// populated — unlike the legacy `category` field, this isn't a "mostly unset" gamble anymore.
const ADDON_DISPLAY_CATEGORIES = new Set<GameSummary["category"]>(["dlc_addon", "expansion", "pack"]);

const GameAddonsSection = ({ addons, onAddonClick }: GameAddonsSectionProps) => {
  const displayedAddons = (addons ?? []).filter((addon) => ADDON_DISPLAY_CATEGORIES.has(addon.category));

  return (
    <>
      <CardHeader title="Addons" subheader="DLC, expansions, and packs for this game" />
      <CardContent>
        {displayedAddons.length === 0 ? (
          <Box sx={{ p: 2 }}>No addons found</Box>
        ) : (
          <VirtualGameGrid
            items={displayedAddons}
            getKey={(addon) => addon.id}
            renderItem={(addon) => (
              <GameCard game={addon} context="addon" contextFunction={() => onAddonClick(addon)} />
            )}
          />
        )}
      </CardContent>
    </>
  );
};

export default GameAddonsSection;
