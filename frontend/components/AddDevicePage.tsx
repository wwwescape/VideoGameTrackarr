import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AddDeviceForm from "./AddDeviceForm";
import HardwareSubNav from "./HardwareSubNav";

const AddDevicePage = () => {
  return (
    <>
      <HardwareSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Device
        </Typography>
      </Box>
      <AddDeviceForm />
    </>
  );
};

export default AddDevicePage;
