import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Autocomplete, {
  type AutocompleteRenderInputParams,
  createFilterOptions,
} from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { createRomDownloadLink } from "../api/library";
import type {
  GameCategory,
  LibraryStatus,
  MediaFormat,
  PlatformResponse,
  RatingBoard,
  RegionResponse,
  RomFileSummary,
} from "../api/types";
import { useEmulationConfig } from "../hooks/useLibrary";
import { useCurrency } from "../theme/CurrencyProvider";
import { getCurrencySymbol } from "../utils/currency";
import { resolveStorefront } from "../utils/digitalStorefronts";
import { RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { downloadFromUrl } from "../utils/download";
import { canHoldRom, fileExtension, formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const formSchema = z.object({
  platformId: z.number({ message: "Platform is required" }),
  regionId: z.number().optional(),
  format: z.enum(["physical", "digital", "iso", "rom", "abandonware", "other"]),
  digitalStorefront: z.string().optional(),
  ratingBoard: z
    .enum(["esrb", "pegi", "cero", "usk", "grac", "classind", "acb", "iarc"])
    .optional(),
  edition: z.string().optional(),
  price: z.number().optional(),
  targetPrice: z.number().optional(),
  trackForSales: z.boolean().optional(),
  steelbook: z.boolean().optional(),
  notes: z.string().optional(),
});

export type LibraryItemFormValues = z.infer<typeof formSchema>;

// What to do with this copy's ROMs once the copy itself is saved — each ROM is a separate
// request (uploads are multipart), so the caller applies these after the create/update call
// returns an id.
export interface RomChanges {
  added: { file: File; label: string | null }[];
  replaced: { romId: number; file: File }[];
  relabelled: { romId: number; label: string | null }[];
  removed: number[];
}

export const NO_ROM_CHANGES: RomChanges = { added: [], replaced: [], relabelled: [], removed: [] };

interface ExistingRomDraft {
  remove: boolean;
  replacement: File | null;
  label: string;
}

interface NewRomDraft {
  key: number;
  file: File;
  label: string;
}

const ROM_LABEL_MAX_LENGTH = 100;

// DLC/Addon, Expansion, and Pack are always sold digitally — never boxed/cartridge — so the
// Format field is locked to "digital" rather than left editable for these. Mirrors the
// backend's HIERARCHICAL_ADDON_CATEGORIES (game_service.py) and this app's other
// ADDON_TYPE_CATEGORIES definitions (AddGame.tsx, ManualGameForm.tsx, LinkToIgdbDialog.tsx) —
// deliberately narrower than the generic isAddon() util (utils.ts), which also counts
// Bundle/Remake/Remaster/Standalone Expansion as "addons" for display purposes even though
// those are routinely sold physically too.
const ALWAYS_DIGITAL_CATEGORIES: GameCategory[] = ["dlc_addon", "expansion", "pack"];

const FORMAT_OPTIONS: { value: MediaFormat; labelKey: string }[] = [
  { value: "physical", labelKey: "dialogs.libraryItem.formatPhysical" },
  { value: "digital", labelKey: "dialogs.libraryItem.formatDigital" },
  { value: "iso", labelKey: "dialogs.libraryItem.formatIso" },
  { value: "rom", labelKey: "dialogs.libraryItem.formatRom" },
  { value: "abandonware", labelKey: "dialogs.libraryItem.formatAbandonware" },
  { value: "other", labelKey: "dialogs.libraryItem.formatOther" },
];

// Must stay in sync with the backend's ITAD_ELIGIBLE_PLATFORM_SLUGS
// (app/services/itad_service.py) and PLATPRICES_ELIGIBLE_PLATFORM_SLUGS
// (app/services/platprices_service.py) — combined into one set since this dialog only needs
// to know "is either provider able to track this row at all," not which one.
const SALES_TRACKING_ELIGIBLE_PLATFORM_SLUGS = new Set([
  "win",
  "linux",
  "mac",
  "android",
  "ps4",
  "ps5",
]);

interface SelectOption {
  value: number | undefined;
  label: string;
  abbreviation?: string | null;
}

const platformFilterOptions = createFilterOptions<SelectOption>({
  stringify: (option) => `${option.label} ${option.abbreviation ?? ""}`,
});

interface RatingBoardOption {
  value: RatingBoard | undefined;
  label: string;
}

interface LibraryItemDialogProps {
  open: boolean;
  title: string;
  status: LibraryStatus;
  platforms: PlatformResponse[];
  regions: RegionResponse[];
  gameCategory?: GameCategory | null;
  defaultValues?: Partial<LibraryItemFormValues>;
  existingRoms?: RomFileSummary[];
  // 0..1 while a ROM upload is in flight (shows a progress bar and locks the dialog), else null.
  uploadProgress?: number | null;
  // Which upload of how many is in flight, when several ROMs are being sent.
  uploadStep?: { current: number; total: number } | null;
  onClose: () => void;
  onSubmit: (values: LibraryItemFormValues, romChanges: RomChanges) => void;
  submitLabel: string;
}

const LibraryItemDialog = ({
  open,
  title,
  status,
  platforms,
  regions,
  gameCategory,
  defaultValues,
  existingRoms = [],
  uploadProgress = null,
  uploadStep = null,
  onClose,
  onSubmit,
  submitLabel,
}: LibraryItemDialogProps) => {
  const { t } = useTranslation();
  const { data: emulationConfig } = useEmulationConfig();
  const [romDrafts, setRomDrafts] = useState<Record<number, ExistingRomDraft>>({});
  const [newRoms, setNewRoms] = useState<NewRomDraft[]>([]);
  const nextNewRomKey = useRef(0);
  // What the shared hidden file input is picking for: new ROMs, or a replacement for one.
  const pickTarget = useRef<number | "new">("new");
  const romInputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploadProgress != null;
  const { currency } = useCurrency();
  const lockFormatToDigital = gameCategory != null && ALWAYS_DIGITAL_CATEGORIES.includes(gameCategory);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LibraryItemFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { format: lockFormatToDigital ? "digital" : "physical", ...defaultValues },
  });

  useEffect(() => {
    if (open) {
      setRomDrafts({});
      setNewRoms([]);
      reset({
        format: "physical",
        ...defaultValues,
        ...(lockFormatToDigital ? { format: "digital" } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A real, selectable "None" entry rather than relying on the clear (x) button — value
  // matches field.value's "nothing selected" state (undefined), so look-ups by value find it
  // automatically and don't need a separate sentinel id.
  const noneOption: SelectOption = { value: undefined, label: t("common.none") };
  const ratingBoardOptions: RatingBoardOption[] = [
    { value: undefined, label: t("common.none") },
    ...(Object.entries(RATING_BOARD_LABELS) as [RatingBoard, string][])
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  // Platform/region already come back alphabetically sorted from the API (Platform.name /
  // Region.name order_by) — "None" is deliberately pinned first on Region rather than sorted
  // into the alphabet, a standard UX convention for a "no selection" entry.
  const platformOptions: SelectOption[] = platforms.map((platform) => ({
    value: platform.id,
    label: platform.name,
    abbreviation: platform.abbreviation,
  }));
  const regionOptions: SelectOption[] = [
    noneOption,
    ...regions.map((region) => ({ value: region.id, label: region.name })),
  ];

  const watchedFormat = useWatch({ control, name: "format" });
  const watchedPlatformId = useWatch({ control, name: "platformId" });
  const selectedPlatform = platforms.find((platform) => platform.id === watchedPlatformId);
  const isDigital = watchedFormat === "digital";
  const { showEditableStorefront, fixedStorefront, digitalStorefrontOptions } = resolveStorefront(
    selectedPlatform,
    isDigital
  );
  const showTrackForSales =
    watchedFormat === "digital" &&
    selectedPlatform?.slug != null &&
    SALES_TRACKING_ELIGIBLE_PLATFORM_SLUGS.has(selectedPlatform.slug);
  const watchedTrackForSales = useWatch({ control, name: "trackForSales" });

  // "fixed" (a locked single-choice store, e.g. Xbox Store), "editable" (the PC-family
  // freeSolo list), or "none" (field hidden). Tracked so a value only ever gets cleared on
  // a genuine mode *transition* — switching between PC-family platforms while "editable"
  // the whole time (Windows -> Mac) should keep whatever the user already typed/picked,
  // but switching away from a "fixed" platform (Xbox -> PC) must not leave that platform's
  // locked store name sitting in the field as if the user had chosen it themselves.
  const storefrontMode = fixedStorefront != null ? "fixed" : showEditableStorefront ? "editable" : "none";
  const previousStorefrontMode = useRef(storefrontMode);
  useEffect(() => {
    if (storefrontMode === "fixed") {
      setValue("digitalStorefront", fixedStorefront);
    } else if (previousStorefrontMode.current !== storefrontMode) {
      // Empty string, not undefined — react-hook-form's setValue does not reliably
      // propagate `undefined` to an already-mounted Controller (confirmed empirically: the
      // MUI Autocomplete kept showing the previous platform's fixed store name even though
      // this effect had run). onSubmit below treats "" the same as "not set".
      setValue("digitalStorefront", "");
    }
    previousStorefrontMode.current = storefrontMode;
  }, [storefrontMode, fixedStorefront, setValue]);

  useEffect(() => {
    if (!showTrackForSales) {
      setValue("trackForSales", false);
      setValue("targetPrice", undefined);
    }
  }, [showTrackForSales, setValue]);

  // Steelbook only means anything for a physical copy — cleared the same way trackForSales
  // is cleared above when its own gating condition stops holding, rather than leaving a
  // stale true value sitting unseen behind a hidden checkbox.
  useEffect(() => {
    if (watchedFormat !== "physical") {
      setValue("steelbook", false);
    }
  }, [watchedFormat, setValue]);

  // The "" digitalStorefront sentinel above (see that effect) is purely a workaround for
  // react-hook-form/MUI Autocomplete's display sync — callers should still only ever see
  // "not set" as undefined, never a literal empty string reaching the API.
  const romAllowed = canHoldRom(status, watchedFormat);
  // ROMs can only be uploaded for platforms a bundled core plays (the backend refuses the
  // rest). ROMs already stored on the copy stay listed, so they can still be downloaded or
  // removed. Until the config has loaded, don't second-guess the backend.
  const platformSupported =
    emulationConfig == null ||
    (selectedPlatform?.slug != null && emulationConfig.supportedPlatformSlugs.includes(selectedPlatform.slug));
  const allowedRomExtensions = (watchedFormat && emulationConfig?.allowedUploadExtensions[watchedFormat]) ?? [];
  const fileError = (file: File): string | null => {
    if (!emulationConfig) return null;
    if (!allowedRomExtensions.includes(fileExtension(file.name))) {
      return t("dialogs.libraryItem.romInvalidType", {
        extensions: allowedRomExtensions.map((ext) => `.${ext}`).join(", "),
      });
    }
    if (file.size > emulationConfig.maxUploadMb * 1024 * 1024) {
      return t("dialogs.libraryItem.romTooLarge", { limit: emulationConfig.maxUploadMb });
    }
    return null;
  };
  const draftFor = (rom: RomFileSummary): ExistingRomDraft =>
    romDrafts[rom.id] ?? { remove: false, replacement: null, label: rom.label ?? "" };
  const updateDraft = (rom: RomFileSummary, patch: Partial<ExistingRomDraft>) =>
    setRomDrafts((drafts) => ({ ...drafts, [rom.id]: { ...draftFor(rom), ...patch } }));
  const hasFileError =
    romAllowed &&
    platformSupported &&
    (newRoms.some((draft) => fileError(draft.file) != null) ||
      existingRoms.some((rom) => {
        const draft = draftFor(rom);
        return !draft.remove && draft.replacement != null && fileError(draft.replacement) != null;
      }));
  // The backend deletes every ROM when a copy stops being an owned ROM/Abandonware/ISO copy
  // (library_service.update_library_item) — warn before that happens, not after.
  const romsWillBeRemoved = existingRoms.length > 0 && !romAllowed;
  // Save states / an in-game save only fit the exact file they were made on, so the backend
  // deletes a ROM's saves whenever that ROM is replaced or removed.
  const romsLosingSaves = existingRoms.filter((rom) => {
    const draft = draftFor(rom);
    const replacing = draft.replacement != null && platformSupported;
    return (!romAllowed || draft.remove || replacing) && (rom.saveStateCount > 0 || rom.hasInGameSave);
  });
  const lostSaveStates = romsLosingSaves.reduce((total, rom) => total + rom.saveStateCount, 0);
  const losesInGameSave = romsLosingSaves.some((rom) => rom.hasInGameSave);

  const handleFormSubmit = (values: LibraryItemFormValues) => {
    if (hasFileError) return;
    const changes: RomChanges = { added: [], replaced: [], relabelled: [], removed: [] };
    if (romAllowed) {
      for (const rom of existingRoms) {
        const draft = draftFor(rom);
        if (draft.remove) {
          changes.removed.push(rom.id);
          continue;
        }
        if (draft.replacement && platformSupported) changes.replaced.push({ romId: rom.id, file: draft.replacement });
        const label = draft.label.trim() || null;
        if (label !== (rom.label ?? null)) changes.relabelled.push({ romId: rom.id, label });
      }
      if (platformSupported) {
        changes.added = newRoms.map((draft) => ({ file: draft.file, label: draft.label.trim() || null }));
      }
    }
    onSubmit({ ...values, digitalStorefront: values.digitalStorefront || undefined }, changes);
  };

  const [downloadingRomId, setDownloadingRomId] = useState<number | null>(null);
  const handleDownload = async (rom: RomFileSummary) => {
    setDownloadingRomId(rom.id);
    try {
      const url = await createRomDownloadLink(rom.id);
      downloadFromUrl(resolveAssetUrl(url) ?? url);
    } catch (error) {
      console.error("Error downloading ROM:", error);
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      toast.error(typeof detail === "string" ? detail : t("dialogs.libraryItem.romDownloadError"), TOAST_OPTIONS);
    } finally {
      setDownloadingRomId(null);
    }
  };

  const pickFiles = (target: number | "new") => {
    pickTarget.current = target;
    romInputRef.current?.click();
  };

  const romUnplayableReasonLabel = (rom: RomFileSummary) =>
    rom.unplayableReason === "unsupported_platform"
      ? t("dialogs.libraryItem.romUnsupportedPlatform")
      : rom.unplayableReason === "missing_bios"
        ? t("dialogs.libraryItem.romMissingBios")
        : t("dialogs.libraryItem.romUnsupportedFileType");

  const labelField = (value: string, onChange: (value: string) => void, disabled = false) => (
    <TextField
      size="small"
      label={t("dialogs.libraryItem.romItemLabel")}
      placeholder={t("dialogs.libraryItem.romItemLabelPlaceholder")}
      value={value}
      disabled={disabled || isUploading}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{ htmlInput: { maxLength: ROM_LABEL_MAX_LENGTH } }}
      sx={{ minWidth: 220, flex: 1 }}
    />
  );

  return (
    <Dialog open={open} onClose={isUploading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="platformId"
            control={control}
            render={({ field }) => (
              <Autocomplete<SelectOption>
                options={platformOptions}
                autoFocus
                filterOptions={platformFilterOptions}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={platformOptions.find((option) => option.value === field.value) ?? null}
                onChange={(_event, option) => field.onChange(option?.value)}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField
                    {...params}
                    label={t("dialogs.libraryItem.platformLabel")}
                    required
                    error={Boolean(errors.platformId)}
                    helperText={errors.platformId?.message ?? t("common.required")}
                  />
                )}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <FormLabel id="format">{t("dialogs.libraryItem.formatLabel")}</FormLabel>
          {lockFormatToDigital ? (
            // Addons (DLC/Expansion/Pack) are always digital — same "locked, nothing to
            // choose" treatment as the Digital Storefront field below for a non-PC platform,
            // rather than an editable RadioGroup where every other option would be wrong.
            <TextField disabled value={t("dialogs.libraryItem.formatDigital")} sx={{ mt: 1 }} />
          ) : (
            <Controller
              name="format"
              control={control}
              render={({ field }) => (
                <RadioGroup row aria-label="format" {...field}>
                  {FORMAT_OPTIONS.map((option) => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio />}
                      label={t(option.labelKey)}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          )}
        </FormControl>
        {watchedFormat === "physical" ? (
          <FormControl fullWidth sx={{ margin: "-10px 0 20px 0" }}>
            <Controller
              name="steelbook"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox checked={field.value ?? false} onChange={(event) => field.onChange(event.target.checked)} />
                  }
                  label={t("dialogs.libraryItem.steelbookLabel")}
                />
              )}
            />
          </FormControl>
        ) : null}
        {romAllowed ? (
          <FormControl fullWidth sx={{ margin: "0 0 20px 0" }}>
            <FormLabel>{t("dialogs.libraryItem.romLabel")}</FormLabel>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {existingRoms.map((rom) => {
                const draft = draftFor(rom);
                const replacementError = draft.replacement ? fileError(draft.replacement) : null;
                return (
                  <Box
                    key={rom.id}
                    data-testid={`rom-row-${rom.id}`}
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
                  >
                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography
                        variant="body2"
                        sx={{ wordBreak: "break-all", textDecoration: draft.remove ? "line-through" : undefined }}
                      >
                        {rom.originalFilename} ({formatFileSize(rom.sizeBytes)})
                      </Typography>
                      {rom.playable ? (
                        <Chip size="small" color="success" label={t("dialogs.libraryItem.romPlayable")} />
                      ) : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${t("dialogs.libraryItem.romNotPlayable")}: ${romUnplayableReasonLabel(rom)}`}
                        />
                      )}
                    </Stack>
                    {draft.replacement && !draft.remove && platformSupported ? (
                      <Typography variant="body2" sx={{ mt: 1, wordBreak: "break-all" }}>
                        {t("dialogs.libraryItem.romReplacing", {
                          name: draft.replacement.name,
                          size: formatFileSize(draft.replacement.size),
                        })}
                      </Typography>
                    ) : null}
                    {draft.remove ? (
                      <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                        {t("dialogs.libraryItem.romWillBeRemoved")}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
                      {labelField(draft.label, (label) => updateDraft(rom, { label }), draft.remove)}
                      {draft.remove ? (
                        <Button size="small" disabled={isUploading} onClick={() => updateDraft(rom, { remove: false })}>
                          {t("dialogs.libraryItem.romUndoRemoveButton")}
                        </Button>
                      ) : (
                        <>
                          {!platformSupported ? null : draft.replacement ? (
                            <Button
                              size="small"
                              disabled={isUploading}
                              onClick={() => updateDraft(rom, { replacement: null })}
                            >
                              {t("common.cancel")}
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              startIcon={<UploadFileIcon />}
                              disabled={isUploading}
                              onClick={() => pickFiles(rom.id)}
                            >
                              {t("dialogs.libraryItem.romReplaceButton")}
                            </Button>
                          )}
                          <Button
                            size="small"
                            startIcon={<DownloadIcon />}
                            disabled={isUploading || downloadingRomId === rom.id}
                            onClick={() => void handleDownload(rom)}
                          >
                            {t("dialogs.libraryItem.romDownloadButton")}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            disabled={isUploading}
                            onClick={() => updateDraft(rom, { remove: true, replacement: null })}
                          >
                            {t("dialogs.libraryItem.romRemoveButton")}
                          </Button>
                        </>
                      )}
                    </Stack>
                    {replacementError && !draft.remove && platformSupported ? (
                      <FormHelperText error>{replacementError}</FormHelperText>
                    ) : null}
                  </Box>
                );
              })}
              {(platformSupported ? newRoms : []).map((draft) => {
                const error = fileError(draft.file);
                return (
                  <Box key={draft.key} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                      {t("dialogs.libraryItem.romSelected", {
                        name: draft.file.name,
                        size: formatFileSize(draft.file.size),
                      })}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
                      {labelField(draft.label, (label) =>
                        setNewRoms((roms) => roms.map((r) => (r.key === draft.key ? { ...r, label } : r)))
                      )}
                      <Button
                        size="small"
                        disabled={isUploading}
                        onClick={() => setNewRoms((roms) => roms.filter((r) => r.key !== draft.key))}
                      >
                        {t("common.cancel")}
                      </Button>
                    </Stack>
                    {error ? <FormHelperText error>{error}</FormHelperText> : null}
                  </Box>
                );
              })}
            </Stack>
            {platformSupported ? (
              <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFileIcon />}
                  disabled={isUploading}
                  onClick={() => pickFiles("new")}
                >
                  {existingRoms.length > 0 || newRoms.length > 0
                    ? t("dialogs.libraryItem.romAddButton")
                    : t("dialogs.libraryItem.romChooseButton")}
                </Button>
              </Box>
            ) : (
              <Alert severity="info" sx={{ mt: 1 }}>
                {selectedPlatform
                  ? t("dialogs.libraryItem.romUnsupportedPlatformNote", { platform: selectedPlatform.name })
                  : t("dialogs.libraryItem.romChoosePlatformNote")}
              </Alert>
            )}
            <input
              ref={romInputRef}
              type="file"
              hidden
              multiple
              data-testid="rom-file-input"
              accept={allowedRomExtensions.map((ext) => `.${ext}`).join(",")}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                const target = pickTarget.current;
                pickTarget.current = "new";
                // Reset so picking the same file again still fires onChange.
                event.target.value = "";
                if (files.length === 0) return;
                if (target === "new") {
                  setNewRoms((roms) => [
                    ...roms,
                    ...files.map((file) => ({ key: nextNewRomKey.current++, file, label: "" })),
                  ]);
                } else {
                  const rom = existingRoms.find((candidate) => candidate.id === target);
                  if (rom) updateDraft(rom, { replacement: files[0] });
                }
              }}
            />
            {platformSupported ? <FormHelperText>{t("dialogs.libraryItem.romHelperText")}</FormHelperText> : null}
            {isUploading ? (
              <Box sx={{ mt: 1 }}>
                <LinearProgress variant="determinate" value={Math.round(uploadProgress * 100)} />
                <Typography variant="caption">
                  {uploadStep && uploadStep.total > 1
                    ? t("dialogs.libraryItem.romUploadingOf", {
                        current: uploadStep.current,
                        total: uploadStep.total,
                        percent: Math.round(uploadProgress * 100),
                      })
                    : t("dialogs.libraryItem.romUploading", { percent: Math.round(uploadProgress * 100) })}
                </Typography>
              </Box>
            ) : null}
          </FormControl>
        ) : null}
        {romsWillBeRemoved ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("dialogs.libraryItem.romFormatChangeWarning", {
              count: existingRoms.length,
              name: existingRoms.map((rom) => rom.originalFilename).join(", "),
            })}
          </Alert>
        ) : null}
        {lostSaveStates > 0 || losesInGameSave ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("dialogs.libraryItem.romSavesWillBeDeleted", {
              details: [
                lostSaveStates > 0 ? t("dialogs.libraryItem.romSaveStateCount", { count: lostSaveStates }) : null,
                losesInGameSave ? t("dialogs.libraryItem.romInGameSave") : null,
              ]
                .filter(Boolean)
                .join(t("dialogs.libraryItem.romSavesJoiner")),
            })}
          </Alert>
        ) : null}
        {showEditableStorefront ? (
          <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
            <Controller
              name="digitalStorefront"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={digitalStorefrontOptions}
                  value={field.value ?? null}
                  // freeSolo Autocomplete keeps its displayed text as separate internal
                  // state from `value` — without also controlling `inputValue`, a
                  // programmatic value change (e.g. this dialog clearing the field when the
                  // platform switches away from a fixed-storefront one) leaves the old text
                  // visibly stuck even though the underlying form value did change.
                  inputValue={field.value ?? ""}
                  onChange={(_event, value) => field.onChange(value ?? undefined)}
                  onInputChange={(_event, value, reason) => {
                    if (reason === "input") field.onChange(value || undefined);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("dialogs.libraryItem.digitalStorefrontLabel")}
                    />
                  )}
                />
              )}
            />
          </FormControl>
        ) : fixedStorefront != null ? (
          // Every non-PC-family digital platform has exactly one real storefront — shown
          // as a disabled dropdown rather than editable, since there's nothing to choose.
          <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
            <Autocomplete
              disabled
              options={[fixedStorefront]}
              value={fixedStorefront}
              renderInput={(params) => (
                <TextField {...params} label={t("dialogs.libraryItem.digitalStorefrontLabel")} />
              )}
            />
          </FormControl>
        ) : null}
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="edition"
            control={control}
            render={({ field }) => (
              <TextField
                fullWidth
                label={t("dialogs.libraryItem.editionLabel")}
                helperText={t("dialogs.libraryItem.editionHelperText")}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormControl>
        {status === "owned" ? (
          <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  type="number"
                  label={t("dialogs.libraryItem.priceLabel")}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(event.target.value === "" ? undefined : Number(event.target.value))
                  }
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">{getCurrencySymbol(currency)}</InputAdornment>,
                    },
                  }}
                />
              )}
            />
          </FormControl>
        ) : null}
        {status === "wishlist" && showTrackForSales ? (
          <FormControl fullWidth sx={{ margin: "10px 0 0 0" }}>
            <Controller
              name="trackForSales"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox checked={field.value ?? false} onChange={(event) => field.onChange(event.target.checked)} />
                  }
                  label={t("dialogs.libraryItem.trackForSalesLabel")}
                />
              )}
            />
          </FormControl>
        ) : null}
        {status === "wishlist" && showTrackForSales && watchedTrackForSales ? (
          <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
            <Controller
              name="targetPrice"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  type="number"
                  label={t("dialogs.libraryItem.targetPriceLabel")}
                  helperText={t("dialogs.libraryItem.targetPriceHelperText")}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? undefined : Number(event.target.value)
                    )
                  }
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">{getCurrencySymbol(currency)}</InputAdornment>,
                    },
                  }}
                />
              )}
            />
          </FormControl>
        ) : null}
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="regionId"
            control={control}
            render={({ field }) => (
              <Autocomplete<SelectOption>
                options={regionOptions}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={regionOptions.find((option) => option.value === field.value) ?? noneOption}
                onChange={(_event, option) => field.onChange(option?.value)}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField {...params} label={t("dialogs.libraryItem.regionLabel")} />
                )}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="ratingBoard"
            control={control}
            render={({ field }) => (
              <Autocomplete<RatingBoardOption>
                options={ratingBoardOptions}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={
                  ratingBoardOptions.find((option) => option.value === field.value) ??
                  ratingBoardOptions[0]
                }
                onChange={(_event, option) => field.onChange(option?.value)}
                renderInput={(params: AutocompleteRenderInputParams) => (
                  <TextField {...params} label={t("dialogs.libraryItem.ratingBoardLabel")} />
                )}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "10px 0 0 0" }}>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t("dialogs.libraryItem.notesLabel")}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={isUploading}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSubmit(handleFormSubmit)}
          color="primary"
          disabled={isUploading || hasFileError}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LibraryItemDialog;
