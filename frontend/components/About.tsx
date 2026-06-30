import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import igdbLogo from "../assets/igdb-logo.png";

const REPO_URL = "https://github.com/wwwescape/VideoGameTrackarr";
const BMC_URL = "https://buymeacoffee.com/wwwescape";

const About = () => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        About
      </Typography>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            VideoGameTrackarr
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            A self-hosted web app for tracking your video game collection: what you own, what
            you want, what you&apos;re playing, and how it&apos;s going.
          </Typography>
          <Typography variant="body2">
            <Link href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source code
            </Link>
          </Typography>
          <Typography variant="body2">
            <Link href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
              Report an issue or request a feature
            </Link>
          </Typography>
          <Typography variant="body2">
            License:{" "}
            <Link href={`${REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">
              GPL-3.0
            </Link>
          </Typography>
          <Typography variant="body2">
            Author:{" "}
            <Link href="https://github.com/wwwescape" target="_blank" rel="noopener noreferrer">
              Eric P Pereira
            </Link>
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Credits
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Link href="https://www.igdb.com" target="_blank" rel="noopener noreferrer">
              <Box component="img" src={igdbLogo} alt="IGDB" sx={{ width: 64 }} />
            </Link>
            <Typography variant="body2" color="text.secondary">
              Game data and cover art are provided by{" "}
              <Link href="https://www.igdb.com" target="_blank" rel="noopener noreferrer">
                IGDB.com
              </Link>
              .
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Link href={BMC_URL} target="_blank" rel="noopener noreferrer">
            <Box
              component="img"
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              sx={{ height: 48 }}
            />
          </Link>
        </CardContent>
      </Card>
    </Box>
  );
};

export default About;
