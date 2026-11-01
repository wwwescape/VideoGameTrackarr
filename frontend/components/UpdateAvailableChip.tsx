import NewReleasesIcon from "@mui/icons-material/NewReleases";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";
import { useVersion } from "../hooks/useVersion";

// Shown in the header while GitHub has a newer release than the one running; opens that
// release's page. Phones get just the icon (the label would squeeze the search box), with
// the version in its tooltip and accessible name.
const UpdateAvailableChip = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const { data } = useVersion();

  if (!data?.updateAvailable) return null;

  const label = t("appShell.updateAvailable", { version: data.latestVersion });

  if (isPhone) {
    return (
      <Tooltip title={label}>
        <IconButton
          component="a"
          href={data.releaseUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          color="secondary"
        >
          <NewReleasesIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Chip
      component="a"
      href={data.releaseUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      clickable
      icon={<NewReleasesIcon />}
      label={label}
      color="secondary"
      size="small"
      sx={{ mr: 1 }}
    />
  );
};

export default UpdateAvailableChip;
