import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import igdbLogo from "../assets/igdb-logo.png";

const REPO_URL = "https://github.com/wwwescape/VideoGameTrackarr";
const BMC_URL = "https://buymeacoffee.com/wwwescape";

const About = () => {
  const { t } = useTranslation();

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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
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
