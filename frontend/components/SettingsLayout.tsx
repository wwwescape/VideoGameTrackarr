import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// Settings layout: titled groups of rows, each row a name and a short description on the left
// and its control on the right (stacked on phones).

interface SettingsGroupProps {
  title: ReactNode;
  lead?: ReactNode;
  // Beside the title (a service logo, a status chip).
  aside?: ReactNode;
  children: ReactNode;
}

export const SettingsGroup = ({ title, lead, aside, children }: SettingsGroupProps) => (
  <Box component="section" sx={{ mb: 2.5 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <Typography variant="h5" component="h2" sx={{ fontSize: 18 }}>
        {title}
      </Typography>
      {aside}
    </Box>
    {lead ? (
      <Typography variant="body2" component="div" sx={{ color: "text.secondary", mt: 0.25 }}>
        {lead}
      </Typography>
    ) : null}
    <Box
      sx={{
        mt: 1.5,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2.5,
        "& > * + *": { borderTop: 1, borderColor: "divider" },
      }}
    >
      {children}
    </Box>
  </Box>
);

interface SettingRowProps {
  // Leave out for a row that's only a wide control (the backup and share panels).
  name?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  // Wide controls (lists, upload areas, notices) go under the name instead of beside it.
  stacked?: boolean;
}

export const SettingRow = ({ name, description, children, stacked = false }: SettingRowProps) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: stacked ? "minmax(0, 1fr)" : { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(240px, 380px)" },
      gap: { xs: 1.5, md: stacked ? 1.5 : 2.5 },
      alignItems: "center",
      px: { xs: 2, sm: 2.5 },
      py: 2,
    }}
  >
    {name ? (
      <Box sx={{ minWidth: 0 }}>
        <Typography component="div" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        {description ? (
          <Typography variant="body2" component="div" sx={{ color: "vgt.text3", mt: 0.375 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
    ) : null}
    {children ? (
      <Box
        sx={{
          minWidth: 0,
          // Full width on phones, so selects and fields aren't squeezed to their content.
          justifySelf: stacked ? "stretch" : { xs: "stretch", md: "end" },
          width: stacked ? "100%" : { xs: "100%", md: "auto" },
        }}
      >
        {children}
      </Box>
    ) : null}
  </Box>
);

// Settings pages' content width: rows read best at a moderate measure.
export const SettingsColumn = ({ children }: { children: ReactNode }) => <Box sx={{ maxWidth: 980 }}>{children}</Box>;
