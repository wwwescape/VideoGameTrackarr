import type { ReactNode } from "react";
import Box from "@mui/material/Box";

// The slim row of a view's own controls under the reader's header (a PDF's page and zoom, a
// text file's wrap and size). Scrolls sideways on a narrow screen rather than wrapping.
const ViewToolbar = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 0.5,
      px: 1.5,
      py: 0.5,
      minHeight: 44,
      borderBottom: 1,
      borderColor: "divider",
      bgcolor: "background.paper",
      overflowX: "auto",
      flexShrink: 0,
    }}
  >
    {children}
  </Box>
);

export default ViewToolbar;
