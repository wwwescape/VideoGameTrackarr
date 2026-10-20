import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { fetchDisplayModeSettings, updateDisplayModeSettings } from "../api/displayMode";

const DisplayModeSection = () => {
  const { t } = useTranslation();
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [showTitle, setShowTitle] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showWishlisted, setShowWishlisted] = useState(false);
  const [mediaCoverArt, setMediaCoverArt] = useState(true);
  const [mediaScreenshots, setMediaScreenshots] = useState(true);
  const [mediaArtwork, setMediaArtwork] = useState(true);
  const [mediaVideos, setMediaVideos] = useState(true);
  const [volume, setVolume] = useState(80);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDisplayModeSettings()
      .then((settings) => {
        if (cancelled) return;
        setIntervalSeconds(settings.slideIntervalSeconds);
        setShowTitle(settings.showTitle);
        setShowHidden(settings.showHidden);
        setShowWishlisted(settings.showWishlisted);
        setMediaCoverArt(settings.mediaCoverArt);
        setMediaScreenshots(settings.mediaScreenshots);
        setMediaArtwork(settings.mediaArtwork);
        setMediaVideos(settings.mediaVideos);
        setVolume(settings.volume);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (patch: {
    slideIntervalSeconds?: number;
    showTitle?: boolean;
    showHidden?: boolean;
    showWishlisted?: boolean;
    mediaCoverArt?: boolean;
    mediaScreenshots?: boolean;
    mediaArtwork?: boolean;
    mediaVideos?: boolean;
    volume?: number;
  }) => {
    try {
      const updated = await updateDisplayModeSettings(patch);
      setIntervalSeconds(updated.slideIntervalSeconds);
      setShowTitle(updated.showTitle);
      setShowHidden(updated.showHidden);
      setShowWishlisted(updated.showWishlisted);
      setMediaCoverArt(updated.mediaCoverArt);
      setMediaScreenshots(updated.mediaScreenshots);
      setMediaArtwork(updated.mediaArtwork);
      setMediaVideos(updated.mediaVideos);
      setVolume(updated.volume);
    } catch {
      // Keep the optimistic local value; the next load re-reads the server value.
    }
  };

  const mediaOptions: {
    label: string;
    checked: boolean;
    set: (value: boolean) => void;
    key: "mediaCoverArt" | "mediaScreenshots" | "mediaArtwork" | "mediaVideos";
  }[] = [
    { label: t("settings.displayMode.mediaCoverArt"), checked: mediaCoverArt, set: setMediaCoverArt, key: "mediaCoverArt" },
    { label: t("settings.displayMode.mediaScreenshots"), checked: mediaScreenshots, set: setMediaScreenshots, key: "mediaScreenshots" },
    { label: t("settings.displayMode.mediaArtwork"), checked: mediaArtwork, set: setMediaArtwork, key: "mediaArtwork" },
    { label: t("settings.displayMode.mediaVideos"), checked: mediaVideos, set: setMediaVideos, key: "mediaVideos" },
  ];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.displayMode.description")}
      </Typography>
      <Typography gutterBottom>
        {t("settings.displayMode.slideInterval", { seconds: intervalSeconds })}
      </Typography>
      <Slider
        value={intervalSeconds}
        min={3}
        max={120}
        step={1}
        disabled={!loaded}
        onChange={(_, value) => setIntervalSeconds(value as number)}
        onChangeCommitted={(_, value) => void save({ slideIntervalSeconds: value as number })}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => t("settings.displayMode.seconds", { count: value })}
        sx={{ maxWidth: 400 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={showTitle}
            disabled={!loaded}
            onChange={(event) => {
              setShowTitle(event.target.checked);
              void save({ showTitle: event.target.checked });
            }}
          />
        }
        label={t("settings.displayMode.showTitle")}
        sx={{ display: "block", mt: 1 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={showHidden}
            disabled={!loaded}
            onChange={(event) => {
              setShowHidden(event.target.checked);
              void save({ showHidden: event.target.checked });
            }}
          />
        }
        label={t("settings.displayMode.showHidden")}
        sx={{ display: "block" }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={showWishlisted}
            disabled={!loaded}
            onChange={(event) => {
              setShowWishlisted(event.target.checked);
              void save({ showWishlisted: event.target.checked });
            }}
          />
        }
        label={t("settings.displayMode.showWishlisted")}
        sx={{ display: "block" }}
      />
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
        {t("settings.displayMode.mediaHeading")}
      </Typography>
      {mediaOptions.map((option) => (
        <FormControlLabel
          key={option.key}
          control={
            <Checkbox
              checked={option.checked}
              disabled={!loaded}
              onChange={(event) => {
                option.set(event.target.checked);
                void save({ [option.key]: event.target.checked });
              }}
            />
          }
          label={option.label}
          sx={{ display: "block" }}
        />
      ))}
      <Typography gutterBottom sx={{ mt: 2 }}>
        {t("settings.displayMode.volume")}
      </Typography>
      <Slider
        value={volume}
        min={0}
        max={100}
        step={1}
        disabled={!loaded}
        onChange={(_, value) => setVolume(value as number)}
        onChangeCommitted={(_, value) => void save({ volume: value as number })}
        valueLabelDisplay="auto"
        sx={{ maxWidth: 400 }}
      />
    </Box>
  );
};

export default DisplayModeSection;
