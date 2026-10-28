import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameDetail } from "../api/types";
import { useSetGameLocalPlayers } from "../hooks/useGames";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";
import { Section } from "./Detail";

const LOCAL_PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16];

type PlayersSectionProps = Pick<
  GameDetail,
  | "id"
  | "localPlayers"
  | "localPlayersOverride"
  | "localPlayersFallback"
  | "localPlayersFallbackSource"
  | "onlineMultiplayer"
  | "coop"
  | "timeToBeatMain"
>;

// The game page's Players: how it's played, as IGDB has it, and the local player count — set
// by hand when IGDB has none or the wrong one (Pico Park has no count on IGDB at all). The
// count is saved as soon as it's picked; clearing it goes back to IGDB's.
const PlayersSection = ({
  id,
  localPlayers,
  localPlayersOverride,
  localPlayersFallback,
  localPlayersFallbackSource,
  onlineMultiplayer,
  coop,
  timeToBeatMain,
}: PlayersSectionProps) => {
  const { t } = useTranslation();
  const setLocalPlayers = useSetGameLocalPlayers(id);
  // Shown straight away; goes back to the saved count if saving fails.
  const [value, setValue] = useState(localPlayersOverride);
  useEffect(() => setValue(localPlayersOverride), [localPlayersOverride]);

  const save = async (next: number | null) => {
    setValue(next);
    try {
      await setLocalPlayers.mutateAsync(next);
    } catch (error) {
      console.error(`Error saving the local players for game ${id}:`, error);
      setValue(localPlayersOverride);
      toast.error(t("games.players.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  // What the filter uses when nothing's set by hand: IGDB's count, else another source's.
  const known = localPlayers
    ? t("games.players.fromIgdb", { count: localPlayers })
    : localPlayersFallback && localPlayersFallbackSource
      ? t(`games.players.from_${localPlayersFallbackSource}`, { count: localPlayersFallback })
      : t("games.players.notKnown");

  const yesNo = (known: boolean | null) =>
    known === null ? t("games.players.unknown") : known ? t("common.yes") : t("common.no");
  const facts = [
    [t("games.players.online"), yesNo(onlineMultiplayer)],
    [t("games.players.coop"), yesNo(coop)],
    [
      t("games.players.timeToBeat"),
      timeToBeatMain
        ? t("games.players.hours", { count: Math.round(timeToBeatMain / 3600) })
        : t("games.players.unknown"),
    ],
  ];

  return (
    <Section id="players" title={t("games.players.title")}>
      <AutocompleteSelect<number>
        label={t("games.players.localLabel")}
        options={LOCAL_PLAYER_COUNTS}
        value={value}
        onChange={(next) => void save(next)}
        getOptionLabel={(count) => t("games.players.localCount", { count })}
        placeholder={t("games.players.sameAsIgdb")}
        helperText={value !== null ? `${t("games.players.setByHand")} ${known}` : known}
        fullWidth
      />
      <Box
        component="dl"
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 2,
          rowGap: 0.5,
          mt: 1.5,
          mb: 0,
        }}
      >
        {facts.map(([label, fact]) => (
          <Box key={label} sx={{ display: "contents" }}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {fact}
            </Typography>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

export default PlayersSection;
