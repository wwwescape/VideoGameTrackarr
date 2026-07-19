import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSetupAdmin } from "../hooks/useAuth";

interface SetupAdminProps {
  onDone: () => void;
}

// Shown at /login in place of the sign-in form when GET /api/auth/setup-status reports no
// admin account exists yet. POST /api/auth/setup logs the new account straight in, same as
// a normal login would, so onDone just redirects like a successful sign-in does.
const SetupAdmin = ({ onDone }: SetupAdminProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setupMutation = useSetupAdmin();

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordsMismatch) return;
    try {
      await setupMutation.mutateAsync({ username, password });
      onDone();
    } catch {
      // surfaced via setupMutation.isError below
    }
  };

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        VideoGameTrackarr
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        No admin account exists yet — create one to get started.
      </Typography>
      {setupMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not create the admin account. It may have already been set up — try signing in
          instead.
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          label="Username"
          fullWidth
          margin="normal"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoFocus
          required
          slotProps={{ htmlInput: { minLength: 3 } }}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          slotProps={{ htmlInput: { minLength: 8 } }}
          helperText="At least 8 characters"
        />
        <TextField
          label="Confirm password"
          type="password"
          fullWidth
          margin="normal"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          error={passwordsMismatch}
          helperText={passwordsMismatch ? "Passwords don't match" : " "}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 1 }}
          disabled={setupMutation.isPending || passwordsMismatch}
        >
          {setupMutation.isPending ? "Creating account..." : "Create admin account"}
        </Button>
      </Box>
    </>
  );
};

export default SetupAdmin;
