import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Autocomplete, { type AutocompleteRenderInputParams, createFilterOptions } from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
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
import type { MediaFormat, PlatformResponse, RatingBoard, RegionResponse } from "../api/types";
import { RATING_BOARD_LABELS } from "../utils/hardwareLabels";

const formSchema = z.object({
  platformId: z.number({ message: "Platform is required" }),
  regionId: z.number().optional(),
  format: z.enum(["physical", "digital", "iso", "rom", "abandonware", "other"]),
  digitalStorefront: z.string().optional(),
  ratingBoard: z.enum(["esrb", "pegi", "cero", "usk", "grac", "classind", "acb", "iarc"]).optional(),
  price: z.number().optional(),
});

export type LibraryItemFormValues = z.infer<typeof formSchema>;

const FORMAT_OPTIONS: { value: MediaFormat; label: string }[] = [
  { value: "physical", label: "Physical" },
  { value: "digital", label: "Digital" },
  { value: "iso", label: "ISO" },
  { value: "rom", label: "ROM" },
  { value: "abandonware", label: "Abandonware" },
  { value: "other", label: "Other" },
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

interface SelectOption {
  value: number | undefined;
  label: string;
  abbreviation?: string | null;
}

// A real, selectable "None" entry rather than relying on the clear (x) button — value
// matches field.value's "nothing selected" state (undefined), so look-ups by value find it
// automatically and don't need a separate sentinel id.
const NONE_OPTION: SelectOption = { value: undefined, label: "None" };

const platformFilterOptions = createFilterOptions<SelectOption>({
  stringify: (option) => `${option.label} ${option.abbreviation ?? ""}`,
});

interface RatingBoardOption {
  value: RatingBoard | undefined;
  label: string;
}

const RATING_BOARD_OPTIONS: RatingBoardOption[] = [
  { value: undefined, label: "None" },
  ...(Object.entries(RATING_BOARD_LABELS) as [RatingBoard, string][]).map(([value, label]) => ({ value, label })),
];

interface LibraryItemDialogProps {
  open: boolean;
  title: string;
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
  platforms,
  regions,
  defaultValues,
  onClose,
  onSubmit,
  submitLabel,
}: LibraryItemDialogProps) => {
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

  const platformOptions: SelectOption[] = platforms.map((platform) => ({
    value: platform.id,
    label: platform.name,
    abbreviation: platform.abbreviation,
  }));
  const regionOptions: SelectOption[] = [NONE_OPTION, ...regions.map((region) => ({ value: region.id, label: region.name }))];

  const watchedFormat = useWatch({ control, name: "format" });
  const watchedPlatformId = useWatch({ control, name: "platformId" });
  const selectedPlatform = platforms.find((platform) => platform.id === watchedPlatformId);
  const showDigitalStorefront = watchedFormat === "digital" && selectedPlatform?.slug === "win";

  useEffect(() => {
    if (!showDigitalStorefront) {
      setValue("digitalStorefront", undefined);
    }
  }, [showDigitalStorefront, setValue]);

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
                    label="Platform"
                    required
                    error={Boolean(errors.platformId)}
                    helperText={errors.platformId?.message ?? "Required"}
                  />
                )}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="regionId"
            control={control}
            render={({ field }) => (
              <Autocomplete<SelectOption>
                options={regionOptions}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={regionOptions.find((option) => option.value === field.value) ?? NONE_OPTION}
                onChange={(_event, option) => field.onChange(option?.value)}
                renderInput={(params: AutocompleteRenderInputParams) => <TextField {...params} label="Region" />}
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
                options={RATING_BOARD_OPTIONS}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={RATING_BOARD_OPTIONS.find((option) => option.value === field.value) ?? RATING_BOARD_OPTIONS[0]}
                onChange={(_event, option) => field.onChange(option?.value)}
                renderInput={(params: AutocompleteRenderInputParams) => <TextField {...params} label="Rating Board" />}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <FormLabel id="format">Format</FormLabel>
          <Controller
            name="format"
            control={control}
            render={({ field }) => (
              <RadioGroup row aria-label="format" {...field}>
                {FORMAT_OPTIONS.map((option) => (
                  <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
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
                  renderInput={(params) => <TextField {...params} label="Digital Storefront" />}
                />
              )}
            />
          </FormControl>
        ) : null}
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="price"
            control={control}
            render={({ field }) => (
              <TextField
                fullWidth
                type="number"
                label="Price"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value === "" ? undefined : Number(event.target.value))}
              />
            )}
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSubmit(onSubmit)} color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LibraryItemDialog;
