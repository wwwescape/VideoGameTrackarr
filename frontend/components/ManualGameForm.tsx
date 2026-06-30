import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { type Dayjs } from "dayjs";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import type { GameCategory, GameSummary } from "../api/types";
import { useCompanies } from "../hooks/useCompanies";
import { useCreateManualGame, useGames } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useUploadCover } from "../hooks/useUploads";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AddGameSuggestionsDialog from "./AddGameSuggestionsDialog";
import AutocompleteSelect from "./AutocompleteSelect";

interface CategoryOption {
  value: GameCategory;
  label: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "main_game", label: "Main Game" },
  { value: "standalone_expansion", label: "Standalone Expansion" },
  { value: "expanded_game", label: "Expanded Game" },
  { value: "bundle", label: "Bundle" },
  { value: "remaster", label: "Remaster" },
  { value: "dlc_addon", label: "DLC / Addon" },
  { value: "expansion", label: "Expansion" },
  { value: "pack", label: "Pack" },
];

// DLC/Addon, Expansion, and Pack only make sense bolted onto an existing copy — everything
// else (including Bundle/Remaster/Standalone Expansion/Expanded Game) is independently
// ownable/playable, so a parent is offered but not required. Mirrors AddGame.tsx/
// LinkToIgdbDialog.tsx's ADDON_TYPE_CATEGORIES split.
const ADDON_TYPE_CATEGORIES: GameCategory[] = ["dlc_addon", "expansion", "pack"];

const ManualGameForm = () => {
  const navigate = useNavigate();
  const createManualGame = useCreateManualGame();
  const uploadCover = useUploadCover();
  const { data: existingGames } = useGames();
  const { data: companies } = useCompanies();
  const { data: platforms } = usePlatforms();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<GameCategory>("main_game");
  const [releaseDate, setReleaseDate] = useState<Dayjs | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [developedBy, setDevelopedBy] = useState<string[]>([]);
  const [publishedBy, setPublishedBy] = useState<string[]>([]);
  const [platformNames, setPlatformNames] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [storyline, setStoryline] = useState("");
  const [edition, setEdition] = useState("");
  const [notes, setNotes] = useState("");
  const [parentGame, setParentGame] = useState<GameSummary | null>(null);
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);

  // Every other top-level game is a valid parent for a DLC/expansion/pack/etc — not just
  // ones explicitly tagged "Main Game", since a manually-added Bundle or Standalone
  // Expansion can legitimately have its own addons too.
  const showParentGameField = category !== "main_game";
  const parentGameRequired = ADDON_TYPE_CATEGORIES.includes(category);
  const parentGameOptions = existingGames ?? [];

  const handleCoverFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { url } = await uploadCover.mutateAsync(file);
      setCoverUrl(url);
    } catch (error) {
      console.error("Error uploading cover image:", error);
      toast.error("Error uploading cover image. Please try again.", TOAST_OPTIONS);
    }
  };

  const submitManualGame = async () => {
    try {
      const game = await createManualGame.mutateAsync({
        name: name.trim(),
        category,
        firstReleaseDate: releaseDate ? releaseDate.unix() : null,
        coverUrl: coverUrl || null,
        developedBy,
        publishedBy,
        platformNames,
        summary: summary.trim() || null,
        storyline: storyline.trim() || null,
        edition: edition.trim() || null,
        notes: notes.trim() || null,
        parentGameId: showParentGameField ? parentGame?.id ?? null : null,
      });
      toast.success("Game added!", TOAST_OPTIONS);
      navigate(`/game/${gameIdentifier(game)}`);
    } catch (error) {
      console.error("Error adding game manually:", error);
      toast.error("Error adding game. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleAddGameClick = () => {
    if (!name.trim()) {
      toast.error("Official Name is required.", TOAST_OPTIONS);
      return;
    }
    if (parentGameRequired && !parentGame) {
      toast.error("Linked Game is required for this category.", TOAST_OPTIONS);
      return;
    }
    // One last check that this isn't already on IGDB before creating a bare-bones custom
    // record — see AddGameSuggestionsDialog.
    setSuggestionsDialogOpen(true);
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            label="Official Name"
            required
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <AutocompleteSelect<CategoryOption>
            label="Category"
            fullWidth
            required
            options={CATEGORY_OPTIONS}
            value={CATEGORY_OPTIONS.find((option) => option.value === category) ?? null}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, val) => option.value === val.value}
            disableClearable
            onChange={(newValue) => {
              const nextCategory = newValue!.value;
              setCategory(nextCategory);
              if (nextCategory === "main_game") setParentGame(null);
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Release date"
              value={releaseDate}
              onChange={(value) => setReleaseDate(value)}
              maxDate={dayjs().add(50, "year")}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", height: "100%" }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={uploadCover.isPending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
              disabled={uploadCover.isPending}
            >
              {coverUrl ? "Replace cover image" : "Upload cover image"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void handleCoverFileChange(event)}
              />
            </Button>
            {coverUrl ? (
              <>
                <Box
                  component="img"
                  src={resolveAssetUrl(coverUrl) ?? undefined}
                  alt="Cover preview"
                  sx={{ height: 56, width: "auto", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                />
                <IconButton size="small" aria-label="Remove cover image" onClick={() => setCoverUrl("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            ) : null}
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            multiple
            freeSolo
            options={(companies ?? []).map((company) => company.name)}
            value={developedBy}
            onChange={(_event, newValue) => setDevelopedBy(newValue)}
            renderInput={(params) => <TextField {...params} label="Developed by" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            multiple
            freeSolo
            options={(companies ?? []).map((company) => company.name)}
            value={publishedBy}
            onChange={(_event, newValue) => setPublishedBy(newValue)}
            renderInput={(params) => <TextField {...params} label="Published by" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Edition"
            fullWidth
            value={edition}
            onChange={(event) => setEdition(event.target.value)}
            helperText='Optional, e.g. "Game of the Year Edition"'
          />
        </Grid>
        <Grid size={12}>
          <Autocomplete
            multiple
            freeSolo
            options={(platforms ?? []).map((platform) => platform.name)}
            value={platformNames}
            onChange={(_event, newValue) => setPlatformNames(newValue)}
            renderInput={(params) => <TextField {...params} label="Available on" />}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Summary"
            fullWidth
            multiline
            minRows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Storyline"
            fullWidth
            multiline
            minRows={3}
            value={storyline}
            onChange={(event) => setStoryline(event.target.value)}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Grid>
        {showParentGameField ? (
          <Grid size={12}>
            <Autocomplete<GameSummary>
              options={parentGameOptions}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={parentGame}
              onChange={(_event, option) => setParentGame(option)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Linked Game"
                  required={parentGameRequired}
                  helperText="Which game is this an addon of?"
                />
              )}
            />
          </Grid>
        ) : null}
        <Grid size={12}>
          <Button variant="contained" onClick={handleAddGameClick} disabled={createManualGame.isPending}>
            Add game
          </Button>
        </Grid>
      </Grid>
      <AddGameSuggestionsDialog
        open={suggestionsDialogOpen}
        name={name.trim()}
        onContinueManually={() => {
          setSuggestionsDialogOpen(false);
          void submitManualGame();
        }}
        onClose={() => setSuggestionsDialogOpen(false)}
      />
    </Paper>
  );
};

export default ManualGameForm;
