import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import type { GameCategory, GameDetail, GameSummary } from "../api/types";
import { useCompanies } from "../hooks/useCompanies";
import { useGame, useGames, useUpdateManualGame } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useUploadCover } from "../hooks/useUploads";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
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

// Mirrors ManualGameForm.tsx's ADDON_TYPE_CATEGORIES.
const ADDON_TYPE_CATEGORIES: GameCategory[] = ["dlc_addon", "expansion", "pack"];

interface EditGameFormProps {
  game: GameDetail;
}

// Mirrors ManualGameForm.tsx's field set, but Category is locked read-only — it isn't
// editable here, only ever set once at creation — and there's no "check IGDB first"
// suggestions step, since that only guards against creating an accidental duplicate.
const EditGameForm = ({ game }: EditGameFormProps) => {
  const navigate = useNavigate();
  const updateManualGame = useUpdateManualGame(game.id);
  const uploadCover = useUploadCover();
  const { data: existingGames } = useGames();
  const { data: companies } = useCompanies();
  const { data: platforms } = usePlatforms();

  const category = game.category ?? "main_game";
  const showParentGameField = category !== "main_game";
  const parentGameRequired = ADDON_TYPE_CATEGORIES.includes(category);
  const parentGameOptions = existingGames ?? [];

  const [name, setName] = useState(game.name);
  const [releaseDate, setReleaseDate] = useState<Dayjs | null>(
    game.firstReleaseDate ? dayjs.unix(game.firstReleaseDate) : null
  );
  const [coverUrl, setCoverUrl] = useState(game.coverUrl ?? "");
  const [developedBy, setDevelopedBy] = useState<string[]>(
    game.companies.filter((company) => company.role === "developer").map((company) => company.name)
  );
  const [publishedBy, setPublishedBy] = useState<string[]>(
    game.companies.filter((company) => company.role === "publisher").map((company) => company.name)
  );
  const [platformNames, setPlatformNames] = useState<string[]>(game.platforms.map((platform) => platform.name));
  const [summary, setSummary] = useState(game.summary ?? "");
  const [storyline, setStoryline] = useState(game.storyline ?? "");
  const [edition, setEdition] = useState(game.edition ?? "");
  const [notes, setNotes] = useState("");
  const [parentGame, setParentGame] = useState<GameSummary | null>(
    parentGameOptions.find((option) => option.id === game.parentGameId) ?? null
  );

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Official Name is required.", TOAST_OPTIONS);
      return;
    }
    if (parentGameRequired && !parentGame) {
      toast.error("Linked Game is required for this category.", TOAST_OPTIONS);
      return;
    }
    try {
      await updateManualGame.mutateAsync({
        name: name.trim(),
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
      toast.success("Game updated!", TOAST_OPTIONS);
      navigate(`/game/${gameIdentifier({ slug: game.slug, uuid: game.uuid, name: name.trim() })}`);
    } catch (error) {
      console.error("Error updating game:", error);
      toast.error("Error updating game. Please try again.", TOAST_OPTIONS);
    }
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
            disabled
            options={CATEGORY_OPTIONS}
            value={CATEGORY_OPTIONS.find((option) => option.value === category) ?? null}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, val) => option.value === val.value}
            disableClearable
            onChange={() => undefined}
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
              <input type="file" accept="image/*" hidden onChange={(event) => void handleCoverFileChange(event)} />
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
            helperText="Adds a new note alongside any existing ones — manage existing notes from the game's own Notes section."
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
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" onClick={() => void handleSubmit()} disabled={updateManualGame.isPending}>
              Save Changes
            </Button>
            <Button
              variant="text"
              onClick={() => navigate(`/game/${gameIdentifier(game)}`)}
              disabled={updateManualGame.isPending}
            >
              Cancel
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

const EditGamePage = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: game, isLoading } = useGame(identifier);

  if (isLoading || !game) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>;
  }

  if (game.igdbId !== null) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        This game cannot be edited. All information comes from IGDB.
      </Paper>
    );
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Edit Game
        </Typography>
      </Box>
      <EditGameForm game={game} />
    </>
  );
};

export default EditGamePage;
