import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useLogin, useSetupStatus } from "../hooks/useAuth";
import SetupAdmin from "./SetupAdmin";

const LoginForm = () => {
  const { t } = useTranslation();
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
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        {t("auth.brand")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("auth.login.subtitle")}
      </Typography>
      {loginMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("auth.login.invalidCredentials")}
        </Alert>
      )}
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          label={t("auth.login.username")}
          fullWidth
          margin="normal"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoFocus
          required
        />
        <TextField
          label={t("auth.login.password")}
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loginMutation.isPending}>
          {loginMutation.isPending ? t("auth.login.signingIn") : t("auth.login.signIn")}
        </Button>
      </Box>
    </>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setupStatus = useSetupStatus();

  const goToApp = () => {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
    navigate(redirectTo, { replace: true });
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
        {setupStatus.isLoading ? (
          // Avoid flashing the wrong form (sign-in vs create-admin) while we don't yet know
          // whether an admin account exists.
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : setupStatus.data?.setupRequired ? (
          <SetupAdmin onDone={goToApp} />
        ) : (
          <LoginForm />
        )}
      </Paper>
    </Box>
  );
};

export default Login;
