import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

// Mirrors the breakpoint -> column-count mapping the grid used before virtualization
// (Grid size={{ xs: 6, sm: 4, md: 3, lg: 2, xl: 2 }} => 2/3/4/6/6 columns).
const COLUMNS_BY_BREAKPOINT = { xs: 2, sm: 3, md: 4, lg: 6, xl: 6 } as const;

export function useResponsiveColumns(): number {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.up("sm"));
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  const isLg = useMediaQuery(theme.breakpoints.up("lg"));
  const isXl = useMediaQuery(theme.breakpoints.up("xl"));

  if (isXl) return COLUMNS_BY_BREAKPOINT.xl;
  if (isLg) return COLUMNS_BY_BREAKPOINT.lg;
  if (isMd) return COLUMNS_BY_BREAKPOINT.md;
  if (isSm) return COLUMNS_BY_BREAKPOINT.sm;
  return COLUMNS_BY_BREAKPOINT.xs;
}
