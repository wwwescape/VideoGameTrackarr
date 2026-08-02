import NewReleasesIcon from "@mui/icons-material/NewReleases";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import { useVersion } from "../hooks/useVersion";

const UpdateAvailableChip = () => {
  const { t } = useTranslation();
  const { data } = useVersion();

  if (!data?.updateAvailable) return null;

  return (
    <Chip
      component="a"
      href={data.releaseUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      clickable
      icon={<NewReleasesIcon />}
      label={t("appShell.updateAvailable", { version: data.latestVersion })}
      color="secondary"
      size="small"
      sx={{ mr: 1 }}
    />
  );
};

export default UpdateAvailableChip;
