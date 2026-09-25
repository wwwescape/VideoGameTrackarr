import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { LibraryStatus, MediaFormat, PlatformResponse, Tag } from "../api/types";
import { useStartBulkImport } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useCreateTag, useTags } from "../hooks/useTags";
import { resolveStorefront } from "../utils/digitalStorefronts";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";
import TagChip from "./TagChip";

interface BulkAddDialogProps {
  open: boolean;
  igdbIds: number[];
  onClose: () => void;
}

const FORMAT_OPTIONS: { value: MediaFormat; labelKey: string }[] = [
  { value: "physical", labelKey: "dialogs.libraryItem.formatPhysical" },
  { value: "digital", labelKey: "dialogs.libraryItem.formatDigital" },
  { value: "iso", labelKey: "dialogs.libraryItem.formatIso" },
  { value: "rom", labelKey: "dialogs.libraryItem.formatRom" },
  { value: "abandonware", labelKey: "dialogs.libraryItem.formatAbandonware" },
  { value: "other", labelKey: "dialogs.libraryItem.formatOther" },
];

function platformOptionLabel(option: PlatformResponse): string {
  return option.abbreviation ? `${option.name} (${option.abbreviation})` : option.name;
}

// Step timeline for bulk-adding N selected IGDB search results at once (AddGame.tsx's
// selection mode) — Step 1 confirms the count, Step 2 (skippable) picks/creates tags to
// apply to every newly-added game, Step 3 (skippable) is a deliberate subset of
// LibraryItemDialog.tsx (Ownership/Platform/Format/Digital Storefront only) applied
// identically to every game. Submitting either way starts the background bulk-import job
// (see bulk_import_job.py) and navigates to the Games list immediately — there's no single
// game to land on, unlike a single-game add.
const BulkAddDialog = ({ open, igdbIds, onClose }: BulkAddDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<LibraryStatus>("owned");
  const [platform, setPlatform] = useState<PlatformResponse | null>(null);
  const [format, setFormat] = useState<MediaFormat>("physical");
  const [digitalStorefront, setDigitalStorefront] = useState("");

  const { data: platforms = [] } = usePlatforms();
  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();
  const startBulkImport = useStartBulkImport();

  // Fresh state every time the dialog is (re-)opened for a new selection.
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSelectedTags([]);
      setStatus("owned");
      setPlatform(null);
      setFormat("physical");
      setDigitalStorefront("");
    }
  }, [open]);

  const isDigital = format === "digital";
  const { showEditableStorefront, fixedStorefront, digitalStorefrontOptions } = resolveStorefront(
    platform ?? undefined,
    isDigital
  );

  // Same "only clear on a genuine mode transition" reasoning as LibraryItemDialog.tsx — a
  // plain useState version of it, since this dialog has no react-hook-form of its own.
  const storefrontMode = fixedStorefront != null ? "fixed" : showEditableStorefront ? "editable" : "none";
  const previousStorefrontMode = useRef(storefrontMode);
  useEffect(() => {
    if (storefrontMode === "fixed") {
      setDigitalStorefront(fixedStorefront ?? "");
    } else if (previousStorefrontMode.current !== storefrontMode) {
      setDigitalStorefront("");
    }
    previousStorefrontMode.current = storefrontMode;
  }, [storefrontMode, fixedStorefront]);

  const handleCreateTag = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const tag = await createTag.mutateAsync({ name: trimmed });
      setSelectedTags((prev) => [...prev, tag]);
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error(t("tags.createError"), TOAST_OPTIONS);
    }
  };

  const handleSubmit = async (includeLibraryDefaults: boolean) => {
    try {
      await startBulkImport.mutateAsync({
        igdbIds,
        tagIds: selectedTags.map((tag) => tag.id),
        libraryDefaults: includeLibraryDefaults
          ? {
              status,
              platformId: platform?.id,
              format,
              digitalStorefront: digitalStorefront || undefined,
            }
          : null,
      });
      onClose();
      navigate("/games");
    } catch (error) {
      console.error("Error starting bulk import:", error);
      toast.error(t("dialogs.bulkAdd.startError"), TOAST_OPTIONS);
    }
  };

  const canSubmitWithLibraryDefaults = platform != null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("dialogs.bulkAdd.title")}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
          <Step>
            <StepLabel>{t("dialogs.bulkAdd.confirmStepLabel")}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t("dialogs.bulkAdd.tagsStepLabel")}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t("dialogs.bulkAdd.libraryStepLabel")}</StepLabel>
          </Step>
        </Stepper>

        {activeStep === 0 ? (
          <Typography>
            {t("dialogs.bulkAdd.confirmMessage", { count: igdbIds.length })}
          </Typography>
        ) : null}

        {activeStep === 1 ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("dialogs.bulkAdd.tagsDescription")}
            </Typography>
            <Autocomplete
              multiple
              freeSolo
              disabled={createTag.isPending}
              options={allTags}
              value={selectedTags}
              getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
              isOptionEqualToValue={(option, value) => option.id === (value as Tag).id}
              onChange={(_event, value, reason, details) => {
                if (reason === "createOption" && details) {
                  // freeSolo createOption's details.option is the raw typed string at
                  // runtime, despite MUI typing it as the option type — same caveat
                  // TagsSection.tsx's identical pattern already documents.
                  void handleCreateTag(details.option as unknown as string);
                  return;
                }
                setSelectedTags(value.filter((option): option is Tag => typeof option !== "string"));
              }}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  if (typeof option === "string") return null;
                  const { key, ...itemProps } = getItemProps({ index });
                  return <TagChip key={key} tag={option} {...itemProps} />;
                })
              }
              renderInput={(params) => (
                <TextField {...params} label={t("tags.addLabel")} placeholder={t("tags.searchPlaceholder")} />
              )}
            />
          </Stack>
        ) : null}

        {activeStep === 2 ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t("dialogs.bulkAdd.libraryDescription")}
            </Typography>
            <RadioGroup row value={status} onChange={(event) => setStatus(event.target.value as LibraryStatus)}>
              <FormControlLabel value="owned" control={<Radio />} label={t("games.listToolbar.filterOwned")} />
              <FormControlLabel
                value="wishlist"
                control={<Radio />}
                label={t("games.listToolbar.filterWishlist")}
              />
            </RadioGroup>
            <AutocompleteSelect<PlatformResponse>
              label={t("dialogs.libraryItem.platformLabel")}
              options={platforms}
              value={platform}
              onChange={setPlatform}
              getOptionLabel={platformOptionLabel}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              fullWidth
            />
            <RadioGroup row value={format} onChange={(event) => setFormat(event.target.value as MediaFormat)}>
              {FORMAT_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={t(option.labelKey)}
                />
              ))}
            </RadioGroup>
            {showEditableStorefront ? (
              <Autocomplete
                freeSolo
                options={digitalStorefrontOptions}
                value={digitalStorefront || null}
                inputValue={digitalStorefront}
                onChange={(_event, value) => setDigitalStorefront(value ?? "")}
                onInputChange={(_event, value, reason) => {
                  if (reason === "input") setDigitalStorefront(value);
                }}
                renderInput={(params) => (
                  <TextField {...params} label={t("dialogs.libraryItem.digitalStorefrontLabel")} />
                )}
              />
            ) : fixedStorefront != null ? (
              <Autocomplete
                disabled
                options={[fixedStorefront]}
                value={fixedStorefront}
                renderInput={(params) => (
                  <TextField {...params} label={t("dialogs.libraryItem.digitalStorefrontLabel")} />
                )}
              />
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        {activeStep === 0 ? (
          <>
            <Button onClick={onClose}>{t("common.cancel")}</Button>
            <Button variant="contained" onClick={() => setActiveStep(1)}>
              {t("dialogs.bulkAdd.nextButton")}
            </Button>
          </>
        ) : null}
        {activeStep === 1 ? (
          <>
            <Button onClick={() => setActiveStep(0)}>{t("common.back")}</Button>
            <Button onClick={() => setActiveStep(2)}>{t("dialogs.bulkAdd.skipButton")}</Button>
            <Button variant="contained" onClick={() => setActiveStep(2)}>
              {t("dialogs.bulkAdd.nextButton")}
            </Button>
          </>
        ) : null}
        {activeStep === 2 ? (
          <>
            <Button onClick={() => setActiveStep(1)}>{t("common.back")}</Button>
            <Button onClick={() => handleSubmit(false)} disabled={startBulkImport.isPending}>
              {t("dialogs.bulkAdd.skipButton")}
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSubmit(true)}
              disabled={!canSubmitWithLibraryDefaults || startBulkImport.isPending}
            >
              {t("dialogs.bulkAdd.submitButton", { count: igdbIds.length })}
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default BulkAddDialog;
