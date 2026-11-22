import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LoginIcon from "@mui/icons-material/Login";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { useConnectGog, useDisconnectGog, useGogStatus } from "../hooks/useIntegrations";
import GogIcon from "../icons/GogIcon";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { SettingRow, SettingsGroup } from "./SettingsLayout";

const POPUP_FEATURES = "popup,width=520,height=760";

// GOG only sends its sign-in back to the GOG Galaxy client's own page, never to VGT, and the
// browser won't let VGT read a GOG page's address. So: sign in in a popup, copy the address
// GOG lands on, paste it here. A pasted address with a code connects straight away, and VGT
// closes the popup it opened.
const hasCode = (value: string) => /[?&]code=[^&\s]+/.test(value);

const GogConnectSection = () => {
  const { t } = useTranslation();
  const { data: status } = useGogStatus();
  const connect = useConnectGog();
  const disconnect = useDisconnectGog();
  const popupRef = useRef<Window | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleSignIn = () => {
    if (!status) return;
    popupRef.current = window.open(status.loginUrl, "vgt-gog-login", POPUP_FEATURES);
    setSigningIn(true);
    setError(null);
  };

  const handleConnect = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || connect.isPending) return;
    setError(null);
    try {
      const updated = await connect.mutateAsync(trimmed);
      popupRef.current?.close();
      popupRef.current = null;
      setSigningIn(false);
      setPasted("");
      toast.success(
        updated.username
          ? t("settings.integrations.gogConnectedToast", { username: updated.username })
          : t("settings.integrations.gogConnectedToastNoName"),
        TOAST_OPTIONS
      );
    } catch (err) {
      console.error("Error connecting GOG:", err);
      setError(
        isAxiosError(err) && err.response?.status === 422
          ? t("settings.integrations.gogConnectRejected")
          : t("settings.integrations.gogConnectError")
      );
    }
  };

  const handleChange = (value: string) => {
    setPasted(value);
    setError(null);
    if (hasCode(value)) void handleConnect(value);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success(t("settings.integrations.gogDisconnectedToast"), TOAST_OPTIONS);
    } catch (err) {
      console.error("Error disconnecting GOG:", err);
      toast.error(t("settings.integrations.gogDisconnectError"), TOAST_OPTIONS);
    } finally {
      setConfirmDisconnect(false);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <SettingsGroup
      title={
        <Stack direction="row" spacing={1.25} component="span" sx={{ alignItems: "center" }}>
          <GogIcon sx={{ fontSize: 28, color: "#86328a" }} />
          <span>{t("settings.integrations.gogHeading")}</span>
        </Stack>
      }
      aside={
        status ? (
          <Chip
            size="small"
            label={
              connected
                ? t("settings.integrations.gogConnectedLabel")
                : t("settings.integrations.gogNotConnectedLabel")
            }
            color={connected ? "success" : "default"}
            variant={connected ? "filled" : "outlined"}
          />
        ) : null
      }
    >
      <SettingRow stacked>
        <Typography variant="body2" component="div" sx={{ color: "text.secondary" }}>
          <Trans
            i18nKey="settings.integrations.gogDescription"
            components={{ 1: <Link component={RouterLink} to="/settings/gog-sync" /> }}
          />
        </Typography>
      </SettingRow>

      {connected ? (
        <SettingRow
          name={
            <Stack direction="row" spacing={1} component="span" sx={{ alignItems: "center" }}>
              <CheckCircleIcon color="success" fontSize="small" />
              <span>
                {status?.username
                  ? t("settings.integrations.gogConnectedAs", { username: status.username })
                  : t("settings.integrations.gogConnectedNoName")}
              </span>
            </Stack>
          }
          description={t("settings.integrations.gogConnectedHelperText")}
        >
          <Button
            color="error"
            onClick={() => setConfirmDisconnect(true)}
            disabled={disconnect.isPending}
          >
            {t("settings.integrations.gogDisconnectButton")}
          </Button>
        </SettingRow>
      ) : (
        <SettingRow stacked>
          <Stack spacing={1.5}>
            <Box>
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={handleSignIn}
                disabled={!status || connect.isPending}
              >
                {t("settings.integrations.gogSignInButton")}
              </Button>
            </Box>
            {signingIn && (
              <>
                <Typography
                  variant="body2"
                  component="ol"
                  sx={{ m: 0, pl: 2.5, "& li": { mb: 0.5 } }}
                >
                  <li>
                    <Trans
                      i18nKey="settings.integrations.gogStepSignIn"
                      components={{
                        1: (
                          <Link
                            href={status?.loginUrl}
                            target="vgt-gog-login"
                            rel="noopener noreferrer"
                          />
                        ),
                      }}
                    />
                  </li>
                  <li>{t("settings.integrations.gogStepCopy")}</li>
                  <li>{t("settings.integrations.gogStepPaste")}</li>
                </Typography>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
                  <TextField
                    label={t("settings.integrations.gogPasteLabel")}
                    placeholder="https://embed.gog.com/on_login_success?…"
                    value={pasted}
                    onChange={(event) => handleChange(event.target.value)}
                    error={error !== null}
                    helperText={error ?? t("settings.integrations.gogPasteHelperText")}
                    disabled={connect.isPending}
                    autoComplete="off"
                    sx={{ flex: "1 1 320px" }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => void handleConnect(pasted)}
                    disabled={connect.isPending || pasted.trim() === ""}
                    sx={{ mt: 1 }}
                  >
                    {connect.isPending
                      ? t("settings.integrations.gogConnecting")
                      : t("settings.integrations.gogConnectButton")}
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </SettingRow>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("settings.integrations.gogDisconnectConfirmTitle")}
        description={t("settings.integrations.gogDisconnectConfirmDescription")}
        confirmLabel={t("settings.integrations.gogDisconnectButton")}
        confirmColor="error"
        busy={disconnect.isPending}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={() => void handleDisconnect()}
      />
    </SettingsGroup>
  );
};

export default GogConnectSection;
