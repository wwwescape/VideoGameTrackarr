import LogoutIcon from "@mui/icons-material/Logout";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useCurrentUser, useLogout } from "../hooks/useAuth";
import { useColorMode } from "../theme/ColorModeProvider";
import { useCurrency } from "../theme/CurrencyProvider";
import { getCurrencySymbol, SUPPORTED_CURRENCIES, type CurrencyOption } from "../utils/currency";
import AutocompleteSelect from "./AutocompleteSelect";
import DataManagementSection from "./DataManagementSection";

// IGDB credentials are .env-only (backend/app/core/config.py) — there's no API to set
// them from the UI, so this page is just account info + logout.
const Settings = () => {
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();
  const { mode, contrast, toggleColorMode, toggleContrast } = useColorMode();
  const { currency, setCurrency } = useCurrency();

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Signed in as <strong>{currentUser?.username ?? "..."}</strong>.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            sx={{ mt: 2 }}
            onClick={() => logoutMutation.mutate()}
          >
            Log out
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Display
          </Typography>
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label="Dark mode"
          />
          <FormControlLabel
            control={<Switch checked={contrast === "high"} onChange={toggleContrast} />}
            label="High contrast"
            sx={{ display: "block" }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Currency
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Used to label MSRP, purchase price, and collection value — this changes how
            amounts are displayed, not a live exchange rate or conversion.
          </Typography>
          <AutocompleteSelect<CurrencyOption>
            label="Currency"
            options={SUPPORTED_CURRENCIES}
            value={SUPPORTED_CURRENCIES.find((option) => option.code === currency) ?? null}
            getOptionLabel={(option) => `${option.name} (${getCurrencySymbol(option.code)})`}
            isOptionEqualToValue={(option, val) => option.code === val.code}
            disableClearable
            onChange={(newValue) => setCurrency(newValue!.code)}
            sx={{ minWidth: 280 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Data
          </Typography>
          <DataManagementSection />

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            IGDB credentials
          </Typography>
          <Alert severity="info">
            IGDB credentials are configured via this server&apos;s <code>.env</code> file
            (<code>IGDB_CLIENT_ID</code> / <code>IGDB_CLIENT_SECRET</code>), not through the app.
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;
