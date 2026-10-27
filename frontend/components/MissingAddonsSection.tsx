import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useGameListState } from "../hooks/useGameListState";
import { useMissingAddons } from "../hooks/useInsights";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import { Section } from "./Detail";
import GameCard from "./GameCard";
import { useGameListControls } from "./GameListControls";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import Page from "./Page";
import VirtualList from "./VirtualList";

// Insights → Missing add-ons: for each owned game, the DLC/expansions/packs you don't have.
// Same filters and toolbar as the Games list (see GameListControls); the filters apply to the
// owned parent game (its platforms, copies, tags, progress), ownership to the add-ons.
const MissingAddonsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // No Game Types (everything here is an add-on) and no Steelbook (an add-on you don't own has
  // no copy to check).
  const state = useGameListState("missingAddons", { gameTypes: false, steelbook: false });
  const [cardSize, setCardSize] = useLocalPreference("missingAddons.cardSize", CARD_SIZE_DEFAULT);
  const controls = useGameListControls(state, {
    view: "covers",
    setView: () => {},
    cardSize,
    setCardSize,
    showViewMenu: false,
    // These sort the owned games the add-ons belong to, which are always in the library.
    sortFields: ["name", "date_added", "type", "release_date", "platforms", "play_status", "rating"],
  });

  const { data: entries } = useMissingAddons(state.apiFilters);

  // Ownership is never sent server-side (see GameList.tsx/CatalogBrowseGrid.tsx's identical
  // client-side treatment) — here it narrows each entry's addons rather than a flat list, so
  // a group whose addons are all filtered out drops out entirely instead of showing an empty
  // addon grid under its game's name.
  const { statuses, exclude, matchAll } = state.ownership;
  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    if (statuses.length === 0) return entries;
    return entries
      .map((entry) => ({
        ...entry,
        missingAddons: entry.missingAddons.filter((addon) => matchesOwnership(addon, statuses, exclude, matchAll)),
      }))
      .filter((entry) => entry.missingAddons.length > 0);
  }, [entries, statuses, exclude, matchAll]);

  return (
    <Page
      meta={entries ? t("insights.missingAddons.gameCount", { count: visibleEntries.length }) : undefined}
      toolbarEnd={controls.toolbarEnd}
      actions={controls.searchField}
    >
      {controls.chipRow}
      {!entries || entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("insights.missingAddons.noneFound")}
        </Typography>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <VirtualList
          items={visibleEntries}
          getKey={(entry) => entry.game.id}
          estimateSize={() => cardSize * (4 / 3) + 160}
          gap={8}
          renderItem={(entry) => (
            <Section
              title={entry.game.name}
              action={
                <Box
                  component={Link}
                  to={`/game/${gameIdentifier(entry.game)}`}
                  sx={{ fontSize: 12.5, fontWeight: 600, color: "primary.main", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  {t("insights.missingAddons.openGame")}
                </Box>
              }
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
                  },
                  gap: "18px 14px",
                }}
              >
                {entry.missingAddons.map((addon) => (
                  <GameCard
                    key={addon.id}
                    game={addon}
                    context="addon"
                    contextFunction={() => navigate(`/addon/${gameIdentifier(addon)}`)}
                  />
                ))}
              </Box>
            </Section>
          )}
        />
      )}
      {controls.dialogs}
    </Page>
  );
};

export default MissingAddonsSection;
