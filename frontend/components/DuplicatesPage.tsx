import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DuplicateLibraryItemsSection from "./DuplicateLibraryItemsSection";
import InsightsSubNav from "./InsightsSubNav";

const DuplicatesPage = () => {
  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Duplicates
        </Typography>
      </Box>
      <DuplicateLibraryItemsSection />
    </>
  );
};

export default DuplicatesPage;
