import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AddAccessoryForm from "./AddAccessoryForm";
import HardwareSubNav from "./HardwareSubNav";

const AddAccessoryPage = () => {
  return (
    <>
      <HardwareSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Accessory
        </Typography>
      </Box>
      <AddAccessoryForm />
    </>
  );
};

export default AddAccessoryPage;
