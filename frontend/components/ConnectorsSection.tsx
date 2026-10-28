import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { Connector, ConnectorInput } from "../api/types";
import {
  useConnectors,
  useCreateConnector,
  useDeleteConnector,
  useRevokeConnectorDevice,
  useUpdateConnector,
} from "../hooks/useConnectors";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import ConnectorDialog from "./ConnectorDialog";
import { SettingRow, SettingsGroup } from "./SettingsLayout";

const codeBlockSx = {
  m: 0,
  p: 1.5,
  borderRadius: 1.5,
  bgcolor: "action.hover",
  fontSize: 12.5,
  overflowX: "auto",
  whiteSpace: "pre",
} as const;

// How a device talks to a connector, with its own address filled in: pair once (a code to
// approve in the app), then send games with the token it got.
const ConnectorApiHelp = ({ connector }: { connector: Connector }) => {
  const { t } = useTranslation();
  const base = `${window.location.origin}/api/connect/${connector.slug}`;
  const nx = connector.kind === "nx_remote_launcher";
  const exampleGames = nx
    ? `[{ "id": "0100EA6014BB8000" }, { "id": "01004EA00DF70000" }]`
    : `[{ "id": "hades", "name": "Hades" }, { "id": "1145360", "name": "Hades II", "igdbId": 270484, "players": 1 }]`;
  return (
    <Stack spacing={1.25} sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        {t("connectors.help.pair")}
      </Typography>
      <Box component="pre" sx={codeBlockSx}>
        {`POST ${base}/pair\n{ "deviceName": "My device" }\n→ { "code": "ABCD-EF23", "pollToken": "…", "approveUrl": "…" }\n\nPOST ${base}/pair/poll\n{ "pollToken": "…" }\n→ { "status": "pending" | "approved" | "expired", "token": "…" }`}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {nx ? t("connectors.help.syncNx") : t("connectors.help.sync")}
      </Typography>
      <Box component="pre" sx={codeBlockSx}>
        {`POST ${base}/sync\nAuthorization: Bearer <token>\n{ "complete": true, "games": ${exampleGames} }\n→ { "added": 1, "existing": 1, "absent": 0, "unknown": [] }`}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {t("connectors.help.complete")}
      </Typography>
    </Stack>
  );
};

const ConnectorCard = ({ connector, onEdit, onDelete }: { connector: Connector; onEdit: () => void; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const revoke = useRevokeConnectorDevice();
  const [showHelp, setShowHelp] = useState(connector.devices.length === 0);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return (
    <SettingRow stacked>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {connector.name}
          </Typography>
          <Chip size="small" variant="outlined" label={t(`connectors.kinds.${connector.kind}.name`)} />
          <Box sx={{ ml: "auto", display: "flex" }}>
            <IconButton size="small" onClick={onEdit} aria-label={t("connectors.editAria", { name: connector.name })}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onDelete} aria-label={t("connectors.deleteAria", { name: connector.name })}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          {`${window.location.origin}/api/connect/${connector.slug}`}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75 }}>
          {connector.lastSyncAt
            ? t("connectors.lastSync", {
                date: formatDate(connector.lastSyncAt),
                present: connector.presentCount,
                absent: connector.absentCount,
              })
            : t("connectors.neverSynced")}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {connector.devices.length ? t("connectors.devices") : t("connectors.noDevices")}
          </Typography>
          {connector.devices.map((device) => (
            <Box key={device.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {device.name}
                <Box component="span" sx={{ color: "text.secondary" }}>
                  {" · "}
                  {device.lastSeenAt
                    ? t("connectors.deviceLastSeen", { date: formatDate(device.lastSeenAt) })
                    : t("connectors.deviceNeverSeen")}
                </Box>
              </Typography>
              <Button
                size="small"
                color="error"
                startIcon={<LinkOffIcon />}
                onClick={() =>
                  revoke.mutate(
                    { connectorId: connector.id, deviceId: device.id },
                    { onError: () => toast.error(t("connectors.revokeError"), TOAST_OPTIONS) }
                  )
                }
              >
                {t("connectors.revoke")}
              </Button>
            </Box>
          ))}
        </Box>
        <Button size="small" sx={{ mt: 1, px: 0 }} onClick={() => setShowHelp((shown) => !shown)}>
          {showHelp ? t("connectors.help.hide") : t("connectors.help.show")}
        </Button>
        {showHelp ? <ConnectorApiHelp connector={connector} /> : null}
      </Box>
    </SettingRow>
  );
};

// Settings -> Integrations -> Connectors: named endpoints other software syncs games into
// (a Switch homebrew, a script, a phone shortcut). Add one as often as needed.
const ConnectorsSection = () => {
  const { t } = useTranslation();
  const { data: connectors = [] } = useConnectors();
  const create = useCreateConnector();
  const update = useUpdateConnector();
  const remove = useDeleteConnector();
  const [editing, setEditing] = useState<Connector | "new" | null>(null);
  const [deleting, setDeleting] = useState<Connector | null>(null);

  const save = (input: ConnectorInput) => {
    const done = {
      onSuccess: () => setEditing(null),
      onError: () => toast.error(t("connectors.saveError"), TOAST_OPTIONS),
    };
    if (editing === "new") create.mutate(input, done);
    else if (editing) update.mutate({ id: editing.id, input }, done);
  };

  return (
    <SettingsGroup title={t("connectors.heading")}>
      <SettingRow stacked>
        <Typography variant="body2" color="text.secondary">
          {t("connectors.description")}
        </Typography>
      </SettingRow>
      {connectors.map((connector) => (
        <ConnectorCard
          key={connector.id}
          connector={connector}
          onEdit={() => setEditing(connector)}
          onDelete={() => setDeleting(connector)}
        />
      ))}
      <SettingRow stacked>
        <Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing("new")}>
            {t("connectors.add")}
          </Button>
        </Box>
      </SettingRow>
      {editing ? (
        <ConnectorDialog
          connector={editing === "new" ? undefined : editing}
          saving={create.isPending || update.isPending}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t("connectors.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("connectors.deleteDescription")}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: () => toast.error(t("connectors.deleteError"), TOAST_OPTIONS),
          })
        }
      />
    </SettingsGroup>
  );
};

export default ConnectorsSection;
