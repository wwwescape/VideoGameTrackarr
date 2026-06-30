import type { ReactNode } from "react";
import Box, { type BoxProps } from "@mui/material/Box";

interface SimpleTabPanelProps extends BoxProps {
  value: string;
  activeValue: string;
  children: ReactNode;
}

// A minimal stand-in for @mui/lab's TabPanel (paired with plain core Tabs/Tab instead of
// TabContext/TabList) — avoids depending on @mui/lab, which is still beta-only in MUI v9.
const SimpleTabPanel = ({ value, activeValue, children, ...boxProps }: SimpleTabPanelProps) => {
  if (value !== activeValue) {
    return null;
  }

  return (
    <Box role="tabpanel" {...boxProps}>
      {children}
    </Box>
  );
};

export default SimpleTabPanel;
