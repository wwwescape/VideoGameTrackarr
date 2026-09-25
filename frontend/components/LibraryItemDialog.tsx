import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import Autocomplete, {
  type AutocompleteRenderInputParams,
  createFilterOptions,
} from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import type {
  GameCategory,
  LibraryStatus,
  MediaFormat,
  PlatformResponse,
  RatingBoard,
  RegionResponse,
} from "../api/types";
import { useCurrency } from "../theme/CurrencyProvider";
import { getCurrencySymbol } from "../utils/currency";
import { resolveStorefront } from "../utils/digitalStorefronts";
import { RATING_BOARD_LABELS } from "../utils/hardwareLabels";

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
  onClose: () => void;
  onSubmit: (values: LibraryItemFormValues) => void;
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
  onClose,
  onSubmit,
  submitLabel,
}: LibraryItemDialogProps) => {
  const { t } = useTranslation();
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
  const handleFormSubmit = (values: LibraryItemFormValues) => {
    onSubmit({ ...values, digitalStorefront: values.digitalStorefront || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
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
        <Button onClick={onClose} color="primary">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit(handleFormSubmit)} color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LibraryItemDialog;
