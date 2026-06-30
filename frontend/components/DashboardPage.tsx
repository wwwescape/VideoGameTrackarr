import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ReleaseCalendarSection from "./ReleaseCalendarSection";

const DashboardPage = () => {
  return (
    <>
      <Typography variant="h5" component="h2" gutterBottom>
        Games Release Calendar
      </Typography>
      <ReleaseCalendarSection scope="games" />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        Hardware Release Calendar
      </Typography>
      <ReleaseCalendarSection scope="hardware" />
    </>
  );
};

export default DashboardPage;
