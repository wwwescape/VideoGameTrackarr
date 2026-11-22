import { Link as RouterLink } from "react-router-dom";
import { isAxiosError } from "axios";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
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
import {
  useAllAddonLinks,
  useRemoveAddonLinkPair,
  useSetAddonIncludedPair,
} from "../hooks/useAddonLinks";
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
  const setIncluded = useSetAddonIncludedPair();

  // One row per add-on, its games in the order the server sorted them (by name).
  const byAddon = new Map<number, { addon: AddonLinkPair["addon"]; games: AddonLinkPair[] }>();
  for (const link of links ?? []) {
    const entry = byAddon.get(link.addon.id) ?? { addon: link.addon, games: [] };
    entry.games.push(link);
    byAddon.set(link.addon.id, entry);
  }

  const handleToggleIncluded = async (link: AddonLinkPair) => {
    try {
      await setIncluded.mutateAsync({
        addonId: link.addon.id,
        gameId: link.game.id,
        included: !link.included,
      });
    } catch (error) {
      console.error("Error changing Included:", error);
      toast.error(t("games.addonLinks.includedError"), TOAST_OPTIONS);
    }
  };

  const handleUnlink = async (addon: AddonLinkPair["addon"], game: AddonLinkPair["game"]) => {
    try {
      await removeLink.mutateAsync({ addonId: addon.id, gameId: game.id });
      toast.success(t("games.addonLinks.unlinkedToast", { name: game.name }), TOAST_OPTIONS);
    } catch (error) {
      const lastLink =
        isAxiosError(error) &&
        error.response?.status === 409 &&
        error.response.data?.detail === LAST_LINK_ORPHAN;
      if (!lastLink) console.error("Error unlinking:", error);
      toast.error(
        lastLink
          ? t("settings.linkedAddons.lastLinkError", { name: addon.name })
          : t("games.addonLinks.unlinkError"),
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
                  <Link
                    component={RouterLink}
                    to={`/addon/${gameIdentifier(addon)}`}
                    underline="hover"
                    color="inherit"
                  >
                    {addon.name}
                  </Link>
                }
                description={t("settings.linkedAddons.worksWith", {
                  count: games.filter((link) => link.manual && !link.pack).length,
                })}
              >
                <Box
                  component="ul"
                  sx={{
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  {games.map((link) => {
                    const { game } = link;
                    const names = { addon: addon.name, game: game.name };
                    return (
                      <Box
                        component="li"
                        key={game.id}
                        sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
                      >
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Link
                            component={RouterLink}
                            // A pack the add-on is inside has an add-on page.
                            to={`/${link.pack ? "addon" : "game"}/${gameIdentifier(game)}`}
                            underline="hover"
                            variant="body2"
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {game.name}
                          </Link>
                          <Typography variant="caption" color="text.secondary" component="div">
                            {[
                              link.pack ? t("games.packs.inPackCaption") : null,
                              link.manual ? null : t("games.addonLinks.fromIgdb"),
                              link.included
                                ? t("games.addonLinks.includedOption")
                                : link.manual
                                  ? t("games.addonLinks.worksWithOption")
                                  : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Typography>
                        </Box>
                        {link.pack ? (
                          // Inside a pack is always Included; take it out to undo.
                          <Box
                            sx={{
                              width: 34,
                              flexShrink: 0,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Inventory2Icon fontSize="small" color="primary" />
                          </Box>
                        ) : (
                          <Tooltip
                            title={t(
                              link.included
                                ? "games.addonLinks.unmarkIncluded"
                                : "games.addonLinks.markIncluded",
                              names
                            )}
                          >
                            <IconButton
                              size="small"
                              color={link.included ? "primary" : "default"}
                              aria-pressed={link.included}
                              disabled={setIncluded.isPending}
                              aria-label={t("games.addonLinks.includedToggleLabel", names)}
                              onClick={() => void handleToggleIncluded(link)}
                            >
                              {link.included ? (
                                <Inventory2Icon fontSize="small" />
                              ) : (
                                <Inventory2OutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        {link.manual ? (
                          <Tooltip title={t("games.addonLinks.unlink")}>
                            <IconButton
                              size="small"
                              disabled={removeLink.isPending}
                              aria-label={t("settings.linkedAddons.unlinkLabel", {
                                addon: addon.name,
                                game: game.name,
                              })}
                              onClick={() => void handleUnlink(addon, game)}
                            >
                              <LinkOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Box sx={{ width: 34, flexShrink: 0 }} />
                        )}
                      </Box>
                    );
                  })}
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
