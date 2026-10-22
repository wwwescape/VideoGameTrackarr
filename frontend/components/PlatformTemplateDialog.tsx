import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import BlockIcon from "@mui/icons-material/Block";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import UploadIcon from "@mui/icons-material/Upload";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { PlatformResponse } from "../api/types";
import { useSetPlatformCaseSize, useSetPlatformSpineStyle, useSetPlatformSpineTemplate } from "../hooks/usePlatforms";
import SpineIconGlyph, { SPINE_ICON_OPTIONS, spineIconGlyph } from "./SpineIcon";
import { platformLogoUrl } from "../utils/platformLogos";
import {
  CASE_SIZE_PRESETS,
  caseSizeToPixels,
  defaultCaseSizeForPlatform,
  effectiveCaseSizeMm,
  presetForDimensions,
} from "../utils/caseSizes";
import { useUploadSpine } from "../hooks/useUploads";

const SPINE_COLOR_SWATCHES = [
  "#e60012", "#17569b", "#107c10", "#1b3a8f", "#5b3ea8", "#8f1d22", "#f2f2f2",
  "#111111", "#f5a623", "#ff7bac", "#3aa6dd", "#2a475e", "#5a4632", "#7ac142",
];

interface PlatformTemplateDialogProps {
  platform: PlatformResponse | null;
  onClose: () => void;
}

// Opened from a Bookshelf platform divider: the uploaded image becomes the
// blank spine template behind EVERY case of that platform on the shelf.
const PlatformTemplateDialog = ({ platform, onClose }: PlatformTemplateDialogProps) => {
  const { t } = useTranslation();
  const uploadSpine = useUploadSpine();
  const setTemplate = useSetPlatformSpineTemplate();
  const setCaseSize = useSetPlatformCaseSize();
  const setSpineStyle = useSetPlatformSpineStyle();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);
  // Custom case size entry: picking "Custom…" in the dropdown reveals
  // height/spine fields; Save stores the entered millimetres on the platform.
  const [customEditing, setCustomEditing] = useState(false);
  const [customHeight, setCustomHeight] = useState("");
  const [customSpine, setCustomSpine] = useState("");
  useEffect(() => {
    setCustomEditing(false);
  }, [platform?.id]);

  const busy = uploadSpine.isPending || setTemplate.isPending;
  const templateUrl = platform?.spineTemplateUrl ?? null;

  // Case size: "auto" = no per-platform choice (the known size for the system
  // applies, if any); a preset id stores that size on the platform.
  const hasOverride = platform != null && platform.caseHeightMm != null && platform.caseSpineMm != null;
  const overridePreset =
    hasOverride && platform ? presetForDimensions(platform.caseHeightMm!, platform.caseSpineMm!) : null;
  const caseSizeValue = customEditing ? "custom" : !hasOverride ? "auto" : (overridePreset?.id ?? "custom");
  const defaultPreset = platform ? defaultCaseSizeForPlatform(platform) : null;
  const autoLabel = defaultPreset
    ? t("games.bookshelf.caseSize.autoKnown", {
        name: defaultPreset.label,
        height: defaultPreset.heightMm,
        spine: defaultPreset.spineMm,
      })
    : t("games.bookshelf.caseSize.autoUnknown");
  const effectiveMm = platform ? effectiveCaseSizeMm(platform) : null;
  // The renders-at helper follows the custom inputs while they're being
  // edited, so the pixel preview updates before anything is saved.
  const parsedHeight = Number(customHeight);
  const parsedSpine = Number(customSpine);
  const customValid =
    customHeight.trim() !== "" &&
    customSpine.trim() !== "" &&
    Number.isFinite(parsedHeight) &&
    Number.isFinite(parsedSpine) &&
    parsedHeight > 0 &&
    parsedSpine > 0 &&
    parsedHeight <= 1000 &&
    parsedSpine <= 1000;
  const previewMm = customEditing
    ? customValid
      ? { heightMm: parsedHeight, spineMm: parsedSpine }
      : null
    : effectiveMm;
  const renderedSize = previewMm
    ? caseSizeToPixels(previewMm.heightMm, previewMm.spineMm)
    : { width: 0, height: 0 };

  const saveSpineStyle = async (color: string | null, icon: string | null, iconUrl?: string | null) => {
    if (!platform) return;
    setError(false);
    try {
      await setSpineStyle.mutateAsync({
        platformId: platform.id,
        color,
        icon,
        iconUrl: iconUrl !== undefined ? iconUrl : icon === "custom" ? platform.spineIconUrl : null,
      });
    } catch {
      setError(true);
    }
  };

  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const handleIconFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !platform) return;
    setError(false);
    try {
      const { url } = await uploadSpine.mutateAsync(file);
      await setSpineStyle.mutateAsync({
        platformId: platform.id,
        color: platform.spineColor,
        icon: "custom",
        iconUrl: url,
      });
    } catch {
      setError(true);
    }
  };

  const handleCaseSizeChange = async (value: string) => {
    if (!platform) return;
    if (value === "custom") {
      // Ask for the size instead of saving anything: prefill from the size
      // currently in effect so tweaking one dimension is a one-field edit.
      const start = effectiveMm ?? { heightMm: 184, spineMm: 14 };
      setCustomHeight(String(start.heightMm));
      setCustomSpine(String(start.spineMm));
      setCustomEditing(true);
      return;
    }
    setCustomEditing(false);
    setError(false);
    try {
      if (value === "auto") {
        await setCaseSize.mutateAsync({ platformId: platform.id, heightMm: null, spineMm: null });
      } else {
        const preset = CASE_SIZE_PRESETS.find((entry) => entry.id === value);
        if (!preset) return;
        await setCaseSize.mutateAsync({
          platformId: platform.id,
          heightMm: preset.heightMm,
          spineMm: preset.spineMm,
        });
      }
    } catch {
      setError(true);
    }
  };

  const handleApplyCustom = async () => {
    if (!platform || !customValid) return;
    setError(false);
    try {
      await setCaseSize.mutateAsync({
        platformId: platform.id,
        heightMm: parsedHeight,
        spineMm: parsedSpine,
      });
      setCustomEditing(false);
    } catch {
      setError(true);
    }
  };

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !platform) return;
    setError(false);
    try {
      const { url } = await uploadSpine.mutateAsync(file);
      await setTemplate.mutateAsync({ platformId: platform.id, spineUrl: url });
      onClose();
    } catch {
      setError(true);
    }
  };

  const handleRemove = async () => {
    if (!platform) return;
    setError(false);
    try {
      await setTemplate.mutateAsync({ platformId: platform.id, spineUrl: null });
      onClose();
    } catch {
      setError(true);
    }
  };

  return (
    <Dialog open={platform !== null} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t("games.bookshelf.template.title", { platform: platform?.name ?? "" })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("games.bookshelf.template.hint")}
        </Typography>
        {templateUrl ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 2,
              p: 1,
              borderRadius: 1,
              backgroundColor: "action.hover",
            }}
          >
            <Box
              component="img"
              src={resolveAssetUrl(templateUrl) ?? undefined}
              alt={platform?.name ?? ""}
              sx={{ height: 190, maxWidth: "100%", objectFit: "contain", display: "block" }}
            />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t("games.bookshelf.template.empty")}
          </Typography>
        )}
        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {t("games.bookshelf.template.saveError")}
          </Typography>
        )}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="case-size-label">{t("games.bookshelf.caseSize.label")}</InputLabel>
          <Select
            labelId="case-size-label"
            value={caseSizeValue}
            label={t("games.bookshelf.caseSize.label")}
            onChange={(event) => handleCaseSizeChange(event.target.value)}
            disabled={busy || setCaseSize.isPending}
          >
            <MenuItem value="auto">{autoLabel}</MenuItem>
            <MenuItem value="custom">
              {hasOverride && !overridePreset
                ? t("games.bookshelf.caseSize.custom", {
                    height: platform?.caseHeightMm,
                    spine: platform?.caseSpineMm,
                  })
                : t("games.bookshelf.caseSize.customOption")}
            </MenuItem>
            {CASE_SIZE_PRESETS.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {t("games.bookshelf.caseSize.preset", {
                  name: preset.label,
                  height: preset.heightMm,
                  spine: preset.spineMm,
                })}
              </MenuItem>
            ))}
          </Select>
          {previewMm && (
            <FormHelperText>
              {t("games.bookshelf.caseSize.renders", {
                height: renderedSize.height,
                width: renderedSize.width,
              })}
            </FormHelperText>
          )}
        </FormControl>
        {customEditing && (
          <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: "flex-start" }}>
            <TextField
              size="small"
              label={t("games.bookshelf.caseSize.heightLabel")}
              type="number"
              value={customHeight}
              onChange={(event) => setCustomHeight(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "any" } }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label={t("games.bookshelf.caseSize.spineLabel")}
              type="number"
              value={customSpine}
              onChange={(event) => setCustomSpine(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "any" } }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleApplyCustom}
              disabled={!customValid || setCaseSize.isPending}
              sx={{ height: 40, flexShrink: 0 }}
            >
              {t("common.save")}
            </Button>
          </Stack>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("games.bookshelf.spineStyle.section")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("games.bookshelf.spineStyle.hint")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("games.bookshelf.spineStyle.colorLabel")}
        </Typography>
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: "wrap", mb: 2, mt: 1, rowGap: 1.25 }}>
          <Button
            size="small"
            variant={platform?.spineColor == null ? "contained" : "outlined"}
            onClick={() => saveSpineStyle(null, platform?.spineIcon ?? "logo")}
            disabled={busy || setSpineStyle.isPending}
          >
            {t("games.bookshelf.spineStyle.colorAuto")}
          </Button>
          {SPINE_COLOR_SWATCHES.map((swatch) => (
            <Box
              key={swatch}
              component="button"
              title={swatch}
              onClick={() => saveSpineStyle(swatch, platform?.spineIcon ?? "logo")}
              disabled={busy || setSpineStyle.isPending}
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                backgroundColor: swatch,
                cursor: "pointer",
                border:
                  platform?.spineColor === swatch ? "3px solid #1976d2" : "1px solid rgba(0,0,0,0.3)",
                p: 0,
              }}
            />
          ))}
          <Tooltip title={t("games.bookshelf.spineStyle.customColor")}>
            <Box
              component="input"
              type="color"
              defaultValue={platform?.spineColor ?? "#888888"}
              key={platform?.spineColor ?? "auto"}
              onBlur={(event: React.FocusEvent<HTMLInputElement>) =>
                saveSpineStyle(event.target.value, platform?.spineIcon ?? "logo")
              }
              sx={{ width: 44, height: 34, border: "none", background: "none", cursor: "pointer", p: 0 }}
            />
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t("games.bookshelf.spineStyle.iconLabel")}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", mt: 0.5 }}>
          {SPINE_ICON_OPTIONS.map(({ key }) => {
            const selected = (platform?.spineIcon ?? "logo") === key;
            const Glyph = key === "none" ? BlockIcon : spineIconGlyph(key);
            return (
              <Tooltip key={key} title={t(`games.bookshelf.spineStyle.icon.${key}`)}>
                <IconButton
                  size="small"
                  onClick={() => saveSpineStyle(platform?.spineColor ?? null, key)}
                  disabled={busy || setSpineStyle.isPending}
                  sx={{
                    border: selected ? "2px solid #1976d2" : "1px solid rgba(128,128,128,0.4)",
                    borderRadius: 1.5,
                  }}
                >
                  {key === "logo" && platformLogoUrl(platform?.slug) ? (
                    <SpineIconGlyph iconKey="logo" slug={platform?.slug} size={20} />
                  ) : (
                    <Glyph sx={{ fontSize: 20 }} />
                  )}
                </IconButton>
              </Tooltip>
            );
          })}
          <Tooltip
            title={t(
              platform?.spineIcon === "custom"
                ? "games.bookshelf.spineStyle.replaceIcon"
                : "games.bookshelf.spineStyle.uploadIcon"
            )}
          >
            <IconButton
              size="small"
              onClick={() => iconInputRef.current?.click()}
              disabled={busy || setSpineStyle.isPending || uploadSpine.isPending}
              sx={{
                border:
                  platform?.spineIcon === "custom"
                    ? "2px solid #1976d2"
                    : "1px dashed rgba(128,128,128,0.6)",
                borderRadius: 1.5,
              }}
            >
              {platform?.spineIcon === "custom" && platform?.spineIconUrl ? (
                <SpineIconGlyph iconKey="custom" slug={platform?.slug} iconUrl={platform.spineIconUrl} size={20} />
              ) : (
                <FileUploadIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleIconFilePicked}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {templateUrl ? t("games.bookshelf.template.replace") : t("games.bookshelf.template.upload")}
          </Button>
          {templateUrl && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemove}
              disabled={busy}
            >
              {t("games.bookshelf.template.remove")}
            </Button>
          )}
        </Stack>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFilePicked}
          aria-label={t("games.bookshelf.template.upload")}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlatformTemplateDialog;
