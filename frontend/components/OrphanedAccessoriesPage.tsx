import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AccessoriesWithoutOwnedHardwareSection from "./AccessoriesWithoutOwnedHardwareSection";
import InsightsSubNav from "./InsightsSubNav";

const OrphanedAccessoriesPage = () => {
  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Orphaned Accessories
        </Typography>
      </Box>
      <AccessoriesWithoutOwnedHardwareSection />
    </>
  );
};

export default OrphanedAccessoriesPage;
