import { Link as RouterLink } from "react-router-dom";
import { isAxiosError } from "axios";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LAST_LINK_ORPHAN, type AddonLinkPair } from "../api/addonLinks";
import { useAllAddonLinks, useRemoveAddonLinkPair } from "../hooks/useAddonLinks";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { withLab } from "./LabGate";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

// Settings → Linked Add-ons (Linked Add-ons lab): every manual link in one place, by add-on,
// each with the games it's linked to and an unlink button. Linking happens on game pages.
const LinkedAddonsSettingsPage = () => {
  const { t } = useTranslation();
  const { data: links, isError } = useAllAddonLinks();
  const removeLink = useRemoveAddonLinkPair();

  // One row per add-on, its games in the order the server sorted them (by name).
  const byAddon = new Map<number, { addon: AddonLinkPair["addon"]; games: AddonLinkPair["game"][] }>();
  for (const { addon, game } of links ?? []) {
    const entry = byAddon.get(addon.id) ?? { addon, games: [] };
    entry.games.push(game);
    byAddon.set(addon.id, entry);
  }

  const handleUnlink = async (addon: AddonLinkPair["addon"], game: AddonLinkPair["game"]) => {
    try {
      await removeLink.mutateAsync({ addonId: addon.id, gameId: game.id });
      toast.success(t("games.addonLinks.unlinkedToast", { name: game.name }), TOAST_OPTIONS);
    } catch (error) {
      const lastLink =
        isAxiosError(error) && error.response?.status === 409 && error.response.data?.detail === LAST_LINK_ORPHAN;
      if (!lastLink) console.error("Error unlinking:", error);
      toast.error(
        lastLink ? t("settings.linkedAddons.lastLinkError", { name: addon.name }) : t("games.addonLinks.unlinkError"),
        TOAST_OPTIONS
      );
    }
  };

  return (
    <SettingsFrame description={t("settings.linkedAddons.description")}>
      <SettingsColumn>
        {isError ? <Alert severity="error">{t("settings.linkedAddons.loadFailed")}</Alert> : null}
        <SettingsGroup
          title={t("settings.linkedAddons.heading")}
          lead={links ? t("settings.linkedAddons.lead", { count: byAddon.size }) : undefined}
        >
          {links && byAddon.size === 0 ? (
            <SettingRow name={null} description={t("settings.linkedAddons.empty")} stacked>
              {null}
            </SettingRow>
          ) : (
            [...byAddon.values()].map(({ addon, games }) => (
              <SettingRow
                key={addon.id}
                name={
                  <Link component={RouterLink} to={`/addon/${gameIdentifier(addon)}`} underline="hover" color="inherit">
                    {addon.name}
                  </Link>
                }
                description={t("settings.linkedAddons.worksWith", { count: games.length })}
              >
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {games.map((game) => (
                    <Box component="li" key={game.id} sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Link
                        component={RouterLink}
                        to={`/game/${gameIdentifier(game)}`}
                        underline="hover"
                        variant="body2"
                        sx={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {game.name}
                      </Link>
                      <Tooltip title={t("games.addonLinks.unlink")}>
                        <IconButton
                          size="small"
                          disabled={removeLink.isPending}
                          aria-label={t("settings.linkedAddons.unlinkLabel", { addon: addon.name, game: game.name })}
                          onClick={() => void handleUnlink(addon, game)}
                        >
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              </SettingRow>
            ))
          )}
        </SettingsGroup>
        {links === undefined && !isError ? (
          <Typography variant="body2" color="text.secondary">
            {t("common.loading")}
          </Typography>
        ) : null}
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default withLab("linked_addons", LinkedAddonsSettingsPage);
