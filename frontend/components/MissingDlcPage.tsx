import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InsightsSubNav from "./InsightsSubNav";
import MissingDlcSection from "./MissingDlcSection";

const MissingDlcPage = () => {
  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Missing DLC
        </Typography>
      </Box>
      <MissingDlcSection />
    </>
  );
};

export default MissingDlcPage;
