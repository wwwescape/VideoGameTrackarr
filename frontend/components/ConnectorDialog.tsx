import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type {
  Connector,
  ConnectorAbsentMode,
  ConnectorInput,
  ConnectorKind,
  MediaFormat,
  PlatformResponse,
} from "../api/types";
import { usePlatforms } from "../hooks/usePlatforms";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import AutocompleteSelect from "./AutocompleteSelect";
import { FORMAT_OPTIONS } from "./GameFilterDialog";

export const CONNECTOR_KINDS: ConnectorKind[] = [
  "custom",
  "nx_remote_launcher",
  "epic",
  "gog",
  "csv",
];

// What a new connector of each kind starts with (all changeable): its name, address and
// where its copies go.
const KIND_DEFAULTS: Partial<
  Record<
    ConnectorKind,
    {
      name: string;
      slug: string;
      platformSlug: string;
      mediaFormat?: MediaFormat;
      storefront?: string;
    }
  >
> = {
  nx_remote_launcher: { name: "Nintendo Switch", slug: "switch", platformSlug: "switch" },
  epic: {
    name: "Epic Games Store",
    slug: "epic",
    platformSlug: "win",
    mediaFormat: "digital",
    storefront: "Epic Games Store",
  },
  gog: { name: "GOG", slug: "gog", platformSlug: "win", mediaFormat: "digital", storefront: "GOG" },
};
const ABSENT_MODES: ConnectorAbsentMode[] = ["keep", "note", "remove"];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,59}$/;

// "Steam Deck" -> "steam-deck": the address part of a new connector, until it's edited.
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface ConnectorDialogProps {
  // Editing this one; a new one otherwise.
  connector?: Connector;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ConnectorInput) => void;
}

// Name, address and defaults of a connector. The kind is only picked when it's created: it
// decides how devices talk to it. Mounted only while open, so it starts fresh each time.
const ConnectorDialog = ({ connector, saving, onClose, onSave }: ConnectorDialogProps) => {
  const { t } = useTranslation();
  const { data: platforms = [] } = usePlatforms();
  const [kind, setKind] = useState<ConnectorKind>(connector?.kind ?? "custom");
  const [name, setName] = useState(connector?.name ?? "");
  const [slug, setSlug] = useState(connector?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(connector));
  const [platformId, setPlatformId] = useState<number | null>(connector?.platformId ?? null);
  const [mediaFormat, setMediaFormat] = useState<MediaFormat | null>(
    connector?.mediaFormat ?? null
  );
  const [storefront, setStorefront] = useState<string | null>(connector?.digitalStorefront ?? null);
  const [wishlist, setWishlist] = useState(connector?.wishlist ?? false);
  const [absentMode, setAbsentMode] = useState<ConnectorAbsentMode>(
    connector?.absentMode ?? "keep"
  );

  const changeKind = (next: ConnectorKind) => {
    setKind(next);
    // A Switch connector's copies are Switch copies, an Epic one's digital Epic Games Store
    // copies on PC...: picked for you, still changeable.
    const defaults = KIND_DEFAULTS[next];
    if (!defaults) return;
    setPlatformId(
      platforms.find((platform) => platform.slug === defaults.platformSlug)?.id ?? null
    );
    setMediaFormat(defaults.mediaFormat ?? null);
    setStorefront(defaults.storefront ?? null);
    if (!name || Object.values(KIND_DEFAULTS).some((other) => other?.name === name)) {
      setName(defaults.name);
      if (!slugEdited) setSlug(defaults.slug);
    }
  };
  const valid = name.trim().length > 0 && SLUG_PATTERN.test(slug);

  const save = () =>
    onSave({
      kind: connector ? undefined : kind,
      name: name.trim(),
      slug,
      platformId,
      mediaFormat,
      digitalStorefront: mediaFormat === "digital" ? storefront : null,
      wishlist,
      absentMode,
    });

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {connector ? t("connectors.dialog.editTitle") : t("connectors.dialog.addTitle")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!connector ? (
            <AutocompleteSelect<ConnectorKind>
              label={t("connectors.dialog.kind")}
              options={CONNECTOR_KINDS}
              value={kind}
              onChange={(next) => next && changeKind(next)}
              getOptionLabel={(option) => t(`connectors.kinds.${option}.name`)}
              helperText={t(`connectors.kinds.${kind}.description`)}
              disableClearable
              fullWidth
            />
          ) : null}
          <TextField
            label={t("connectors.dialog.name")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            fullWidth
          />
          <TextField
            label={t("connectors.dialog.slug")}
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
            error={slug.length > 0 && !SLUG_PATTERN.test(slug)}
            helperText={t("connectors.dialog.slugHelp", {
              url: `${window.location.origin}/api/connect/${slug || "…"}`,
            })}
            fullWidth
          />
          <AutocompleteSelect<PlatformResponse>
            label={t("connectors.dialog.platform")}
            options={platforms}
            value={platforms.find((platform) => platform.id === platformId) ?? null}
            onChange={(next) => setPlatformId(next?.id ?? null)}
            getOptionLabel={(platform) => platform.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            fullWidth
          />
          <AutocompleteSelect<MediaFormat>
            label={t("connectors.dialog.format")}
            options={FORMAT_OPTIONS.map((option) => option.value)}
            value={mediaFormat}
            onChange={setMediaFormat}
            getOptionLabel={(value) =>
              FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? value
            }
            fullWidth
          />
          {mediaFormat === "digital" ? (
            <AutocompleteSelect<string>
              label={t("connectors.dialog.storefront")}
              options={[...ALL_KNOWN_STOREFRONTS]}
              value={storefront}
              onChange={setStorefront}
              getOptionLabel={(value) => value}
              fullWidth
            />
          ) : null}
          <FormControlLabel
            control={
              <Switch checked={wishlist} onChange={(event) => setWishlist(event.target.checked)} />
            }
            label={t("connectors.dialog.wishlist")}
          />
          <AutocompleteSelect<ConnectorAbsentMode>
            label={t("connectors.dialog.absentMode")}
            options={ABSENT_MODES}
            value={absentMode}
            onChange={(next) => next && setAbsentMode(next)}
            getOptionLabel={(mode) => t(`connectors.absentModes.${mode}`)}
            disableClearable
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button variant="contained" onClick={save} disabled={!valid || saving}>
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectorDialog;
