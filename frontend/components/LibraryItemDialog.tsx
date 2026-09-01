import { useEffect } from "react";
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
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import type {
  LibraryStatus,
  MediaFormat,
  PlatformResponse,
  RatingBoard,
  RegionResponse,
} from "../api/types";
import { RATING_BOARD_LABELS } from "../utils/hardwareLabels";

const formSchema = z.object({
  platformId: z.number({ message: "Platform is required" }),
  regionId: z.number().optional(),
  format: z.enum(["physical", "digital", "iso", "rom", "abandonware", "other"]),
  digitalStorefront: z.string().optional(),
  ratingBoard: z
    .enum(["esrb", "pegi", "cero", "usk", "grac", "classind", "acb", "iarc"])
    .optional(),
  price: z.number().optional(),
  targetPrice: z.number().optional(),
  trackForSales: z.boolean().optional(),
});

export type LibraryItemFormValues = z.infer<typeof formSchema>;

const FORMAT_OPTIONS: { value: MediaFormat; labelKey: string }[] = [
  { value: "physical", labelKey: "dialogs.libraryItem.formatPhysical" },
  { value: "digital", labelKey: "dialogs.libraryItem.formatDigital" },
  { value: "iso", labelKey: "dialogs.libraryItem.formatIso" },
  { value: "rom", labelKey: "dialogs.libraryItem.formatRom" },
  { value: "abandonware", labelKey: "dialogs.libraryItem.formatAbandonware" },
  { value: "other", labelKey: "dialogs.libraryItem.formatOther" },
];

// PC is the only platform with more than one realistic digital storefront — consoles are
// tied to their manufacturer's own store, so this list only needs to cover PC. Free text
// (via Autocomplete's freeSolo) still works for anything not on the list.
const PC_DIGITAL_STOREFRONT_OPTIONS = [
  "Steam",
  "Epic Games Store",
  "GOG",
  "Ubisoft Connect",
  "EA App",
  "Battle.net",
  "Microsoft Store",
  "itch.io",
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
  defaultValues,
  onClose,
  onSubmit,
  submitLabel,
}: LibraryItemDialogProps) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LibraryItemFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { format: "physical", ...defaultValues },
  });

  useEffect(() => {
    if (open) {
      reset({ format: "physical", ...defaultValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A real, selectable "None" entry rather than relying on the clear (x) button — value
  // matches field.value's "nothing selected" state (undefined), so look-ups by value find it
  // automatically and don't need a separate sentinel id.
  const noneOption: SelectOption = { value: undefined, label: t("common.none") };
  const ratingBoardOptions: RatingBoardOption[] = [
    { value: undefined, label: t("common.none") },
    ...(Object.entries(RATING_BOARD_LABELS) as [RatingBoard, string][]).map(([value, label]) => ({
      value,
      label,
    })),
  ];

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
  const showDigitalStorefront = watchedFormat === "digital" && selectedPlatform?.slug === "win";
  const showTrackForSales =
    watchedFormat === "digital" &&
    selectedPlatform?.slug != null &&
    SALES_TRACKING_ELIGIBLE_PLATFORM_SLUGS.has(selectedPlatform.slug);
  const watchedTrackForSales = useWatch({ control, name: "trackForSales" });

  useEffect(() => {
    if (!showDigitalStorefront) {
      setValue("digitalStorefront", undefined);
    }
  }, [showDigitalStorefront, setValue]);

  useEffect(() => {
    if (!showTrackForSales) {
      setValue("trackForSales", false);
      setValue("targetPrice", undefined);
    }
  }, [showTrackForSales, setValue]);

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
        </FormControl>
        {showDigitalStorefront ? (
          <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
            <Controller
              name="digitalStorefront"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={PC_DIGITAL_STOREFRONT_OPTIONS}
                  value={field.value ?? null}
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
        ) : null}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit(onSubmit)} color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LibraryItemDialog;
