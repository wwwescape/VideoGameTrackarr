import { Link as RouterLink, useMatches } from "react-router-dom";
import type { UIMatch } from "react-router-dom";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Crumb, RouteHandle } from "./breadcrumbConfig";

export const BREADCRUMBS_HEIGHT = 40;

const crumbTextSx = {
  maxWidth: { xs: 140, sm: 280 },
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

interface BreadcrumbsProps {
  top: number;
  left: number;
}

// Each matched route (root -> leaf) may contribute its own crumb trail via handle.crumbs;
// only leaf page routes define one, so this is normally just the current route's trail.
const Breadcrumbs = ({ top, left }: BreadcrumbsProps) => {
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[];
  const crumbs: Crumb[] = matches.flatMap((match) => match.handle?.crumbs(match.params) ?? []);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Paper
      square
      elevation={0}
      sx={{
        position: "fixed",
        top,
        left,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        height: BREADCRUMBS_HEIGHT,
        display: "flex",
        alignItems: "center",
        px: { xs: 1.5, sm: 2, md: 3 },
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <MuiBreadcrumbs aria-label="Breadcrumb" sx={{ minWidth: 0, "& ol": { flexWrap: "nowrap" } }}>
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1 || !crumb.to;
          return isCurrent ? (
            <Typography key={index} variant="body2" color="text.primary" sx={crumbTextSx}>
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={index}
              component={RouterLink}
              to={crumb.to as string}
              variant="body2"
              underline="hover"
              color="inherit"
              sx={crumbTextSx}
            >
              {crumb.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Paper>
  );
};

export default Breadcrumbs;
