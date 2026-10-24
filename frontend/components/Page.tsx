import { forwardRef, Fragment, useContext, useEffect, useRef, type ReactNode } from "react";
import { Link, UNSAFE_DataRouterStateContext } from "react-router-dom";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import ButtonBase, { type ButtonBaseProps } from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { Crumb, RouteHandle } from "../navigation/breadcrumbConfig";
import { HEADER_HEIGHT } from "../navigation/Sidebar";

// The page toolbar's height; content that sticks under it (a list's own filter bar) uses
// STICKY_TOP, and sections scrolled to by an in-page link leave SECTION_SCROLL_MARGIN_TOP
// so they don't land under the header and toolbar.
export const PAGE_TOOLBAR_HEIGHT = { xs: 56, sm: 50 };
export const STICKY_TOP = {
  xs: HEADER_HEIGHT + PAGE_TOOLBAR_HEIGHT.xs,
  sm: HEADER_HEIGHT + PAGE_TOOLBAR_HEIGHT.sm,
};
export const SECTION_SCROLL_MARGIN_TOP = { xs: STICKY_TOP.xs + 8, sm: STICKY_TOP.sm + 8 };

// Each matched route (root -> leaf) may contribute its own crumb trail via handle.crumbs (see
// router.tsx and navigation/breadcrumbConfig.tsx); only leaf page routes define one, so this
// is normally just the current route's trail. Read from the data router's state rather than
// useMatches(), which throws outside a data router — a page rendered on its own (a test's
// MemoryRouter) then simply has no route crumbs.
export function useRouteCrumbs(): Crumb[] {
  const { t } = useTranslation();
  const matches = useContext(UNSAFE_DataRouterStateContext)?.matches ?? [];
  return matches.flatMap(
    (match) => (match.route.handle as RouteHandle | undefined)?.crumbs(match.params, t) ?? []
  );
}

interface PageProps {
  // Defaults to the route's own crumbs; pass these only to override them.
  crumbs?: Crumb[];
  // Small text after the crumbs: "98 games", "Updated 2 days ago".
  meta?: ReactNode;
  // ToolbarButtons, left to right. Pass `toolbarEnd` for the right-hand group.
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
  // Full-bleed content between the toolbar and the padded body (a detail page's hero).
  hero?: ReactNode;
  // Right of the breadcrumbs: a list's own search field, say. Wraps under them on phones.
  actions?: ReactNode;
  children?: ReactNode;
}

// Every signed-in page: a sticky toolbar of icon+label actions under the header, breadcrumbs
// in place of a big page title, then the content. Replaces the old h4 titles and sub-navs.
const Page = ({
  crumbs: crumbsOverride,
  meta,
  toolbar,
  toolbarEnd,
  hero,
  actions,
  children,
}: PageProps) => {
  const routeCrumbs = useRouteCrumbs();
  const crumbs = crumbsOverride ?? routeCrumbs;
  const toolbarRef = useRef<HTMLDivElement>(null);

  // A toolbar of tabs (Settings) can be wider than a phone; bring the current one into view.
  // Once on mount is enough: each tab is its own route, so its page mounts afresh.
  useEffect(() => {
    toolbarRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <>
      {toolbar || toolbarEnd ? (
        <Box
          ref={toolbarRef}
          role="toolbar"
          sx={{
            position: "sticky",
            top: HEADER_HEIGHT,
            zIndex: (t) => t.zIndex.appBar - 1,
            minHeight: PAGE_TOOLBAR_HEIGHT,
            display: "flex",
            alignItems: "center",
            gap: "2px",
            px: { xs: 0.75, sm: 1.75 },
            bgcolor: "background.default",
            borderBottom: 1,
            borderColor: "divider",
            // Scrolls sideways when its actions don't fit (always on phones; on wider screens
            // only for a long row, such as Settings' tabs plus a page action).
            overflowX: "auto",
            scrollbarWidth: "thin",
          }}
        >
          {toolbar}
          {/* Only when there's a right-hand group: a toolbar with its own spacer would
              otherwise split the free space and strand its right group mid-row. */}
          {toolbarEnd ? <Box sx={{ flexGrow: 1 }} /> : null}
          {toolbarEnd}
        </Box>
      ) : null}
      {hero}
      <Box sx={{ px: { xs: 1.5, sm: 2.75 }, pt: { xs: 1.75, sm: 2.25 }, pb: 5 }}>
        {crumbs.length || actions ? (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              columnGap: 2,
              rowGap: 1.25,
              mb: 1.75,
            }}
          >
            <Box
              component="nav"
              aria-label="Breadcrumb"
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: 0.75,
                fontSize: 13,
                color: "vgt.text3",
                minWidth: 0,
              }}
            >
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={index}>
                    {index > 0 ? <span aria-hidden>›</span> : null}
                    {crumb.to && !last ? (
                      <Box
                        component={Link}
                        to={crumb.to}
                        sx={{
                          color: "inherit",
                          textDecoration: "none",
                          "&:hover": { color: "text.primary" },
                        }}
                      >
                        {crumb.label}
                      </Box>
                    ) : (
                      <Typography
                        component={last ? "h1" : "span"}
                        sx={{
                          fontSize: "inherit",
                          fontWeight: 600,
                          color: "text.primary",
                          overflowWrap: "anywhere",
                        }}
                        aria-current={last ? "page" : undefined}
                      >
                        {crumb.label}
                      </Typography>
                    )}
                  </Fragment>
                );
              })}
              {meta ? (
                <Box component="span" sx={{ ml: 1 }}>
                  {meta}
                </Box>
              ) : null}
            </Box>
            {actions}
          </Box>
        ) : null}
        {children}
      </Box>
    </>
  );
};

export default Page;

interface ToolbarButtonProps extends Omit<ButtonBaseProps, "children"> {
  icon: ReactNode;
  label: string;
  // Accent-colored, for the page's main action (Add, Save).
  primary?: boolean;
  danger?: boolean;
  // A toggle that's on (a view mode, selection mode, the current tab).
  active?: boolean;
  // Small count badge on the icon (filters in use, selected items).
  count?: number;
  // Router link instead of a button.
  to?: string;
  // Route state for the link.
  state?: unknown;
  // External link, opened in a new tab.
  href?: string;
  // Phones: hide the label to save room (the icon keeps it as its accessible name).
  hideLabelOnPhone?: boolean;
}

// Icon + label on desktop, label under the icon on phones.
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      icon,
      label,
      primary,
      danger,
      active,
      count,
      to,
      state,
      href,
      hideLabelOnPhone,
      sx,
      ...props
    },
    ref
  ) => {
    const linkProps = to
      ? { component: Link, to, state }
      : href
        ? { component: "a", href, target: "_blank", rel: "noopener noreferrer" }
        : {};
    return (
      <ButtonBase
        ref={ref}
        aria-label={label}
        {...linkProps}
        {...props}
        aria-pressed={active === undefined || to ? undefined : active}
        aria-current={to && active ? "page" : undefined}
        sx={[
          {
            display: "inline-flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            gap: { xs: "1px", sm: 0.875 },
            flexShrink: 0,
            height: { xs: 50, sm: 34 },
            px: { xs: 1, sm: 1.25 },
            borderRadius: 1.5,
            fontSize: { xs: 11, sm: 13 },
            fontWeight: 550,
            whiteSpace: "nowrap",
            color: danger
              ? "error.main"
              : primary
                ? "primary.main"
                : active
                  ? "text.primary"
                  : "text.secondary",
            bgcolor: active ? "vgt.surface2" : "transparent",
            "&:hover": {
              bgcolor: "vgt.surfaceHover",
              color: danger ? "error.main" : primary ? "primary.main" : "text.primary",
            },
            "&.Mui-disabled": { opacity: 0.45 },
            "& svg": { fontSize: 20 },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Badge
          badgeContent={count}
          color="primary"
          invisible={!count}
          sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16, px: 0.5 } }}
        >
          <Box component="span" sx={{ display: "flex" }}>
            {icon}
          </Box>
        </Badge>
        <Box
          component="span"
          sx={hideLabelOnPhone ? { display: { xs: "none", sm: "inline" } } : undefined}
        >
          {label}
        </Box>
      </ButtonBase>
    );
  }
);
ToolbarButton.displayName = "ToolbarButton";

// Thin divider between toolbar groups (hidden on phones, where the row scrolls).
export const ToolbarDivider = () => (
  <Box
    aria-hidden
    sx={{
      display: { xs: "none", sm: "block" },
      width: "1px",
      height: 22,
      bgcolor: "divider",
      mx: 0.75,
      flexShrink: 0,
    }}
  />
);
