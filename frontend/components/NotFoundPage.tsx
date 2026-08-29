import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface NotFoundPageProps {
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}

// Shared by the router's unmatched-route ("*") catch-all and every detail/browse page's
// isError branch (a deleted/nonexistent game, device, accessory, series, or collection) —
// same shape, just different copy and a different "go back" destination.
const NotFoundPage = ({ title, message, actionLabel, actionTo }: NotFoundPageProps) => {
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {message}
      </Typography>
      <Button variant="contained" onClick={() => navigate(actionTo)}>
        {actionLabel}
      </Button>
    </Paper>
  );
};

export default NotFoundPage;
