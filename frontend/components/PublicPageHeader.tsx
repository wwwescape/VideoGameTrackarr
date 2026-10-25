import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// A share-link page's title with its search (and sort) beside it, wrapping under it on phones.
const PublicPageHeader = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2.5 }}>
    <Typography variant="h1" sx={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em", flexGrow: 1 }}>
      {title}
    </Typography>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: "auto" } }}>{children}</Box>
  </Box>
);

export default PublicPageHeader;
