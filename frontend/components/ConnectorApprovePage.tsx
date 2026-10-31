import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useApproveConnectorPairing, useConnectorPairing } from "../hooks/useConnectors";
import SettingsFrame from "./SettingsFrame";
import { SettingRow, SettingsColumn, SettingsGroup } from "./SettingsLayout";

// Where a device's pairing link (or QR code) lands: shows which device wants to sync into
// which connector, and lets it in. Signed in only, like the rest of the app, so a stranger
// who learns a code can't approve it.
const ConnectorApprovePage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const code = (params.get("code") ?? "").trim().toUpperCase();
  const [typed, setTyped] = useState(code);
  const pairing = useConnectorPairing(code);
  const approve = useApproveConnectorPairing();

  return (
    <SettingsFrame>
      <SettingsColumn>
        <SettingsGroup title={t("connectors.approve.heading")}>
          <SettingRow stacked>
            {approve.isSuccess ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Typography>
                  {t("connectors.approve.done", {
                    device: pairing.data?.deviceName,
                    connector: pairing.data?.connectorName,
                  })}
                </Typography>
              </Box>
            ) : pairing.data ? (
              <Box>
                <Typography sx={{ mb: 1.5 }}>
                  {t("connectors.approve.question", {
                    device: pairing.data.deviceName,
                    connector: pairing.data.connectorName,
                    code: pairing.data.code,
                  })}
                </Typography>
                <Button
                  variant="contained"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(code)}
                >
                  {t("connectors.approve.button")}
                </Button>
                {approve.isError ? (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {t("connectors.approve.error")}
                  </Alert>
                ) : null}
              </Box>
            ) : (
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  label={t("connectors.approve.codeLabel")}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value.toUpperCase())}
                  error={pairing.isError}
                  helperText={
                    pairing.isError
                      ? t("connectors.approve.unknownCode")
                      : t("connectors.approve.codeHelp")
                  }
                  slotProps={{ htmlInput: { maxLength: 9 } }}
                />
                <Button
                  variant="outlined"
                  sx={{ mt: 1 }}
                  onClick={() => setParams({ code: typed.trim() })}
                >
                  {t("connectors.approve.check")}
                </Button>
              </Box>
            )}
          </SettingRow>
          <SettingRow stacked>
            <Button
              component={RouterLink}
              to="/settings/integrations"
              sx={{ alignSelf: "flex-start", px: 0 }}
            >
              {t("connectors.approve.backToIntegrations")}
            </Button>
          </SettingRow>
        </SettingsGroup>
      </SettingsColumn>
    </SettingsFrame>
  );
};

export default ConnectorApprovePage;
