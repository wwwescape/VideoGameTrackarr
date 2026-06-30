import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLogin } from "../hooks/useAuth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch {
      // surfaced via loginMutation.isError below
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400, borderRadius: 2 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          VideoGameTrackarr
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to your collection.
        </Typography>
        {loginMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Invalid username or password.
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
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
