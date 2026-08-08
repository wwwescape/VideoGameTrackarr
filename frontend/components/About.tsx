import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import igdbLogo from "../assets/igdb-logo.png";
import { useVersion } from "../hooks/useVersion";

const REPO_URL = "https://github.com/wwwescape/VideoGameTrackarr";
const BMC_URL = "https://buymeacoffee.com/wwwescape";

const About = () => {
  const { t } = useTranslation();
  const { data: version, refetch, isFetching } = useVersion();
  // Only surface the "up to date" confirmation after the user has explicitly asked us to
  // check — on initial load, staying silent when there's no update is the existing behavior.
  const [hasCheckedManually, setHasCheckedManually] = useState(false);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("about.title")}
      </Typography>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            {t("about.appName")}
          </Typography>
          {version && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("about.version", { version: version.currentVersion })}
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                disabled={isFetching}
                onClick={() => {
                  setHasCheckedManually(true);
                  refetch();
                }}
              >
                {t("about.checkForUpdates")}
              </Button>
            </Stack>
          )}
          {version?.updateAvailable && (
            <Typography variant="body2">
              <Link href={version.releaseUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                {t("about.updateAvailable", { version: version.latestVersion })}
              </Link>
            </Typography>
          )}
          {hasCheckedManually && !isFetching && version && !version.updateAvailable && (
            <Typography variant="body2" color="text.secondary">
              {t("about.upToDate")}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: version ? 1.5 : 0 }}>
            {t("about.description")}
          </Typography>
          <Typography variant="body2">
            <Link href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t("about.sourceCode")}
            </Link>
          </Typography>
          <Typography variant="body2">
            <Link href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
              {t("about.reportIssue")}
            </Link>
          </Typography>
          <Typography variant="body2">
            {t("about.licenseLabel")}{" "}
            <Link href={`${REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">
              {t("about.licenseName")}
            </Link>
          </Typography>
          <Typography variant="body2">
            {t("about.authorLabel")}{" "}
            <Link href="https://github.com/wwwescape" target="_blank" rel="noopener noreferrer">
              {t("about.authorName")}
            </Link>
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t("about.creditsHeading")}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Link href="https://www.igdb.com" target="_blank" rel="noopener noreferrer">
              <Box component="img" src={igdbLogo} alt={t("about.igdbLogoAlt")} sx={{ width: 64 }} />
            </Link>
            <Typography variant="body2" color="text.secondary">
              <Trans
                i18nKey="about.igdbCredits"
                components={{
                  1: <Link href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" />,
                }}
              />
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Link href={BMC_URL} target="_blank" rel="noopener noreferrer">
            <Box
              component="img"
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt={t("about.buyMeACoffeeAlt")}
              sx={{ height: 48 }}
            />
          </Link>
        </CardContent>
      </Card>
    </Box>
  );
};

export default About;
