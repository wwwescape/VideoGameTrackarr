import { useMemo, useRef, useState, type DragEvent } from "react";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { isAxiosError, isCancel } from "axios";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type {
  Guide,
  GuideChanges,
  GuideKind,
  GuideSource,
  LibraryItem,
  PlatformResponse,
} from "../api/types";
import {
  useCreateGuideFile,
  useCreateGuideLink,
  useGuideUploadOptions,
  useReplaceGuideFile,
  useUpdateGuide,
} from "../hooks/useGuides";
import CheatIcon from "../icons/CheatIcon";
import GuideIcon from "../icons/GuideIcon";
import { formatFileSize } from "../utils/fileSize";
import {
  FALLBACK_EXTENSIONS,
  domainOf,
  guideFileError,
  guidePlatformOptions,
  nameFromFilename,
  parseGuideLink,
} from "../utils/guides";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

const MAX_NAME_LENGTH = 200;

interface GuideDialogProps {
  open: boolean;
  gameId: number;
  // Edit this entry; Add a new one when absent.
  guide?: Guide;
  // Opened from a row whose file is missing: point at Replace.
  highlightReplace?: boolean;
  libraryItems: LibraryItem[] | undefined;
  gamePlatforms: PlatformResponse[] | undefined;
  onClose: () => void;
}

function isCancelled(error: unknown): boolean {
  return isCancel(error) || (isAxiosError(error) && error.code === "ERR_CANCELED");
}

// Add or edit a Guides & Cheats entry: its type (Guide / Cheat), where it comes from (an
// uploaded file or a link), a name and an optional platform. Files are checked here first
// (type, size) so a refused one isn't uploaded; the server still has the final say.
const GuideDialog = ({
  open,
  gameId,
  guide,
  highlightReplace,
  libraryItems,
  gamePlatforms,
  onClose,
}: GuideDialogProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isEdit = guide !== undefined;
  const { data: uploadOptions } = useGuideUploadOptions();
  const createFile = useCreateGuideFile(gameId);
  const createLink = useCreateGuideLink(gameId);
  const updateGuide = useUpdateGuide(gameId);
  const replaceFile = useReplaceGuideFile(gameId);

  const [kind, setKind] = useState<GuideKind>(guide?.kind ?? "guide");
  const [source, setSource] = useState<GuideSource>(guide?.source ?? "file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(guide?.url ?? "");
  const [linkTouched, setLinkTouched] = useState(false);
  const [name, setName] = useState(guide?.name ?? "");
  // Once you've typed a name (or are editing one), it's no longer filled in for you.
  const [nameTouched, setNameTouched] = useState(isEdit);
  const [platformId, setPlatformId] = useState<number | "">(guide?.platformId ?? "");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const platforms = useMemo(
    () => guidePlatformOptions(libraryItems, gamePlatforms),
    [libraryItems, gamePlatforms]
  );
  const extensions = uploadOptions?.extensions ?? FALLBACK_EXTENSIONS;
  const maxMb = uploadOptions?.maxUploadMb;

  const fileError = file ? guideFileError(file, uploadOptions) : null;
  const parsedLink = parseGuideLink(link);
  const hasCurrentFile = guide?.source === "file" && !guide.fileMissing;
  // A new file is needed when adding one, or turning a link into a file.
  const fileRequired = source === "file" && (!guide || guide.source === "link");

  const canSave =
    !saving &&
    (source === "file" ? !fileError && (!fileRequired || file !== null) : parsedLink !== null) &&
    name.length <= MAX_NAME_LENGTH;

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setServerError(null);
    if (!nameTouched) setName(nameFromFilename(picked.name));
  };

  const changeLink = (value: string) => {
    setLink(value);
    setServerError(null);
    const parsed = parseGuideLink(value);
    if (!nameTouched && parsed) setName(domainOf(parsed));
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!saving) pickFile(event.dataTransfer.files?.[0]);
  };

  const handleClose = () => {
    if (saving) {
      abortRef.current?.abort();
    }
    onClose();
  };

  const showSaveError = (error: unknown) => {
    if (isCancelled(error)) return;
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const detail = isAxiosError<{ detail?: unknown }>(error)
      ? error.response?.data?.detail
      : undefined;
    if ((status === 400 || status === 413) && typeof detail === "string") {
      setServerError(detail);
      return;
    }
    console.error("Error saving guide:", error);
    toast.error(t("guides.errors.saveError"), TOAST_OPTIONS);
  };

  const save = async () => {
    setSaving(true);
    setServerError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const onProgress = (fraction: number) => setProgress(fraction);
    const trimmedName = name.trim();
    const platform = platformId === "" ? null : platformId;
    try {
      if (!guide) {
        const fields = { kind, name: trimmedName || null, platformId: platform };
        if (source === "file" && file) {
          await createFile.mutateAsync({ file, fields, onProgress, signal: controller.signal });
        } else {
          await createLink.mutateAsync({ url: link.trim(), fields });
        }
        toast.success(
          t(kind === "cheat" ? "guides.addedCheat" : "guides.addedGuide"),
          TOAST_OPTIONS
        );
      } else {
        const changes: GuideChanges = {};
        if (trimmedName !== guide.name) changes.name = trimmedName;
        if (kind !== guide.kind) changes.kind = kind;
        if (platform !== guide.platformId) changes.platformId = platform;
        if (source === "link" && (guide.source === "file" || link.trim() !== guide.url))
          changes.url = link.trim();
        if (Object.keys(changes).length) {
          await updateGuide.mutateAsync({ guideId: guide.id, changes });
        }
        if (source === "file" && file) {
          await replaceFile.mutateAsync({
            guideId: guide.id,
            file,
            onProgress,
            signal: controller.signal,
          });
        }
        toast.success(t("guides.saved"), TOAST_OPTIONS);
      }
      onClose();
    } catch (error) {
      showSaveError(error);
    } finally {
      abortRef.current = null;
      setSaving(false);
      setProgress(null);
    }
  };

  const handleSave = () => {
    if (guide?.source === "file" && source === "link") {
      setConfirmSwitch(true);
      return;
    }
    void save();
  };

  const linkError = source === "link" && linkTouched && link.trim() !== "" && parsedLink === null;
  const fileMessage = fileError
    ? t(`guides.errors.${fileError}`, { max: maxMb })
    : source === "file"
      ? serverError
      : null;

  return (
    <>
      <Dialog
        open={open}
        onClose={saving ? undefined : handleClose}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
        aria-labelledby="guide-dialog-title"
      >
        <DialogTitle id="guide-dialog-title">
          {isEdit ? t("guides.dialog.editTitle") : t("guides.dialog.addTitle")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: 13 }}>
                {t("guides.dialog.kindLabel")}
              </FormLabel>
              <ToggleButtonGroup
                exclusive
                value={kind}
                onChange={(_event, value: GuideKind | null) => value && setKind(value)}
                disabled={saving}
                aria-label={t("guides.dialog.kindLabel")}
                size="small"
              >
                <ToggleButton value="guide" sx={{ gap: 1, px: 2 }}>
                  <GuideIcon fontSize="small" />
                  {t("guides.kind.guide")}
                </ToggleButton>
                <ToggleButton value="cheat" sx={{ gap: 1, px: 2 }}>
                  <CheatIcon fontSize="small" />
                  {t("guides.kind.cheat")}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <FormLabel id="guide-source-label" sx={{ fontSize: 13 }}>
                {t("guides.dialog.sourceLabel")}
              </FormLabel>
              <RadioGroup
                row
                aria-labelledby="guide-source-label"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as GuideSource);
                  setServerError(null);
                }}
              >
                <FormControlLabel
                  value="file"
                  control={<Radio size="small" />}
                  label={t("guides.source.file")}
                  disabled={saving}
                />
                <FormControlLabel
                  value="link"
                  control={<Radio size="small" />}
                  label={t("guides.source.link")}
                  disabled={saving}
                />
              </RadioGroup>
            </Box>

            {source === "file" ? (
              <Box>
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept={extensions.map((ext) => `.${ext}`).join(",")}
                  data-testid="guide-file-input"
                  onChange={(event) => {
                    pickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Box
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!saving) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  sx={{
                    border: 2,
                    borderStyle: "dashed",
                    borderColor: fileMessage ? "error.main" : dragging ? "primary.main" : "divider",
                    bgcolor: dragging ? "vgt.accentSoft" : "transparent",
                    borderRadius: 2,
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  {file || hasCurrentFile ? (
                    <>
                      <InsertDriveFileOutlinedIcon sx={{ color: "text.secondary" }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                        >
                          {file ? file.name : guide?.originalFilename}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {formatFileSize(file ? file.size : (guide?.sizeBytes ?? 0))}
                        </Typography>
                      </Box>
                      {file ? (
                        <IconButton
                          size="small"
                          aria-label={t("guides.dialog.removeFile")}
                          disabled={saving}
                          onClick={() => {
                            setFile(null);
                            setServerError(null);
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={saving}
                          onClick={() => inputRef.current?.click()}
                        >
                          {t("guides.dialog.replace")}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {guide?.fileMissing
                          ? t("guides.dialog.fileMissingHint")
                          : t("guides.dialog.dropHere")}
                      </Typography>
                      <Button
                        size="small"
                        variant={highlightReplace ? "contained" : "outlined"}
                        disabled={saving}
                        onClick={() => inputRef.current?.click()}
                      >
                        {guide?.source === "file"
                          ? t("guides.dialog.replace")
                          : t("guides.dialog.chooseFile")}
                      </Button>
                    </>
                  )}
                </Box>
                {progress !== null ? (
                  <LinearProgress
                    variant="determinate"
                    value={Math.round(progress * 100)}
                    sx={{ mt: 1 }}
                    aria-label={t("guides.dialog.uploading")}
                  />
                ) : null}
                <FormHelperText error={Boolean(fileMessage)}>
                  {fileMessage ??
                    (maxMb != null
                      ? t("guides.dialog.acceptedTypes", { max: maxMb })
                      : t("guides.dialog.acceptedTypesNoLimit"))}
                </FormHelperText>
              </Box>
            ) : (
              <TextField
                label={t("guides.dialog.linkLabel")}
                type="url"
                placeholder="https://"
                value={link}
                disabled={saving}
                onChange={(event) => changeLink(event.target.value)}
                onBlur={() => setLinkTouched(true)}
                error={linkError || Boolean(serverError)}
                helperText={serverError ?? (linkError ? t("guides.errors.badLink") : " ")}
                fullWidth
                autoFocus={!isEdit}
              />
            )}

            <TextField
              label={t("guides.dialog.nameLabel")}
              value={name}
              disabled={saving}
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
              }}
              helperText={
                source === "file"
                  ? t("guides.dialog.nameHelperFile")
                  : t("guides.dialog.nameHelperLink")
              }
              slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
              fullWidth
            />

            <TextField
              select
              label={t("guides.dialog.platformLabel")}
              value={platformId}
              disabled={saving}
              onChange={(event) =>
                setPlatformId(event.target.value === "" ? "" : Number(event.target.value))
              }
              fullWidth
            >
              <MenuItem value="">
                <em>{t("common.none")}</em>
              </MenuItem>
              {platforms.owned.map((platform) => (
                <MenuItem key={platform.id} value={platform.id}>
                  {platform.name}
                </MenuItem>
              ))}
              {platforms.other.length ? (
                <ListSubheader>{t("guides.dialog.otherPlatforms")}</ListSubheader>
              ) : null}
              {platforms.other.map((platform) => (
                <MenuItem key={platform.id} value={platform.id}>
                  {platform.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={handleSave}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isEdit ? t("common.save") : t("common.add")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmSwitch}
        title={t("guides.dialog.switchToLinkTitle")}
        description={t("guides.dialog.switchToLinkNote")}
        confirmLabel={t("guides.dialog.switchToLinkConfirm")}
        confirmColor="error"
        onClose={() => setConfirmSwitch(false)}
        onConfirm={() => {
          setConfirmSwitch(false);
          void save();
        }}
      />
    </>
  );
};

export default GuideDialog;
