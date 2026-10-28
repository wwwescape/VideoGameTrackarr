import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Crumb } from "../navigation/breadcrumbConfig";
import { SECTION_SCROLL_MARGIN_TOP } from "./Page";

// Building blocks for the detail pages (game, add-on, device, accessory, event), shared with
// DieCastCollectionTracker's 2026 redesign: a hero with the item's art over a backdrop, then
// titled sections of facts, galleries and strips of related items.

interface DetailHeroProps {
  // The hero's background: shown sharp (an artwork or screenshot, faded into the page) or as
  // a blurred wash of the cover/photo when there's no artwork.
  backdrop: { url: string; blur: boolean } | null;
  // The cover or product photo, sized by the hero's left column.
  media: ReactNode;
  mediaWidth: { xs: number | string; md: number };
  // Parent pages (the last route crumb is the title itself, shown as the h1 here).
  crumbs: Crumb[];
  title: ReactNode;
  subline: ReactNode[];
  pills: ReactNode;
  // External links (a game's IGDB and store pages), on their own row under the pills.
  links?: ReactNode;
}

export const DetailHero = ({ backdrop, media, mediaWidth, crumbs, title, subline, pills, links }: DetailHeroProps) => (
  <Box
    component="section"
    sx={{
      position: "relative",
      overflow: "hidden",
      borderBottom: 1,
      borderColor: "divider",
      "&::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        background: (theme) =>
          backdrop && !backdrop.blur
            ? `linear-gradient(180deg, ${theme.palette.background.default}44 0%, ${theme.palette.background.default}99 45%, ${theme.palette.background.default} 100%), linear-gradient(90deg, ${theme.palette.background.default}bb 0%, transparent 70%)`
            : `linear-gradient(180deg, transparent 0%, ${theme.palette.background.default} 100%)`,
      },
    }}
  >
    {backdrop ? (
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: backdrop.blur ? -40 : 0,
          backgroundImage: `url("${backdrop.url}")`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          ...(backdrop.blur ? { filter: "blur(36px) saturate(1.3)", opacity: 0.4 } : {}),
        }}
      />
    ) : null}
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: { xs: `${typeof mediaWidth.xs === "number" ? `${mediaWidth.xs}px` : mediaWidth.xs} 1fr`, md: `${mediaWidth.md}px 1fr` },
        gap: { xs: 1.75, md: 3.25 },
        alignItems: "end",
        px: { xs: 1.75, md: 3.5 },
        pt: { xs: 8, md: 5 },
        pb: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>{media}</Box>
      <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
        {crumbs.length ? (
          <Box
            component="nav"
            aria-label="Breadcrumb"
            sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1, fontSize: 13, color: "text.secondary" }}
          >
            {crumbs.map((crumb, index) => (
              <Fragment key={index}>
                {index > 0 ? <span aria-hidden>›</span> : null}
                {crumb.to ? (
                  <Box
                    component={Link}
                    to={crumb.to}
                    sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: "text.primary" } }}
                  >
                    {crumb.label}
                  </Box>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </Fragment>
            ))}
          </Box>
        ) : null}
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 24, md: 34 }, lineHeight: 1.1, mb: 1, wordBreak: "break-word" }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 1,
            rowGap: 0.25,
            alignItems: "center",
            color: "text.secondary",
            fontSize: { xs: 13.5, md: 15 },
            mb: 1.75,
          }}
        >
          {subline.filter(Boolean).map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <Box component="span" aria-hidden sx={{ color: "vgt.text3" }}>
                  ·
                </Box>
              ) : null}
              <span>{part}</span>
            </Fragment>
          ))}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>{pills}</Box>
        {links ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>{links}</Box> : null}
      </Box>
    </Box>
  </Box>
);

interface PillProps {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "owned" | "wishlist" | "accent" | "success" | "danger";
  // Shorter, for a chip inside a list row.
  small?: boolean;
  href?: string;
  to?: string;
  title?: string;
}

const PILL_TONES = {
  owned: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "vgt.owned" },
  wishlist: { border: "rgba(255,107,139,.45)", bg: "rgba(255,107,139,.12)", color: "vgt.wishlist" },
  success: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "vgt.owned" },
  danger: { border: "rgba(229,83,75,.45)", bg: "rgba(229,83,75,.12)", color: "error.main" },
  accent: { border: "primary.main", bg: "vgt.accentSoft", color: "text.primary" },
} as const;

// Rounded fact chip in the hero (status, play status, platforms, series, links...).
export const Pill = ({ icon, children, tone, href, to, title, small = false }: PillProps) => {
  const link = href
    ? { component: "a", href, target: "_blank", rel: "noopener noreferrer" }
    : to
      ? { component: Link, to }
      : {};
  const colors = tone ? PILL_TONES[tone] : null;
  return (
    <Box
      component="span"
      title={title}
      {...link}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.625,
        height: small ? 24 : 28,
        px: small ? 1 : 1.25,
        borderRadius: 3.5,
        fontSize: small ? 12 : 12.5,
        fontWeight: 500,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textDecoration: "none",
        border: 1,
        borderColor: colors?.border ?? "vgt.border",
        bgcolor: colors?.bg ?? "vgt.surface2",
        color: colors?.color ?? "text.primary",
        "& svg": { fontSize: 16, flexShrink: 0 },
        ...(href || to ? { "&:hover": { borderColor: "primary.main" } } : {}),
      }}
    >
      {icon}
      {children}
    </Box>
  );
};

// A titled block with a hairline running out to the right, and an optional action at its end.
// `id` keeps in-page links working (the Duplicates page links to a game's #library).
export const Section = ({
  id,
  title,
  action,
  children,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <Box component="section" id={id} sx={{ pt: { xs: 2.25, md: 2.75 }, scrollMarginTop: SECTION_SCROLL_MARGIN_TOP }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, minHeight: 28 }}>
      <Typography variant="overline" component="h2" sx={{ color: "primary.main", fontWeight: 700, lineHeight: 1.4 }}>
        {title}
      </Typography>
      <Box sx={{ flexGrow: 1, height: "1px", bgcolor: "divider" }} />
      {action}
    </Box>
    {children}
  </Box>
);

// A section's content in a bordered panel (tables, forms, lists that need a surface).
export const Panel = ({ children }: { children: ReactNode }) => (
  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", overflow: "hidden" }}>
    {children}
  </Box>
);

export const Facts = ({ facts }: { facts: [string, ReactNode][] }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1.25 }}>
    {facts
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => (
        <Box
          key={label}
          sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, px: 1.5, py: 1.25, minWidth: 0 }}
        >
          <Typography sx={{ fontSize: 11.5, color: "vgt.text3" }}>{label}</Typography>
          <Typography component="div" sx={{ fontWeight: 600, mt: 0.25, wordBreak: "break-word" }}>
            {value}
          </Typography>
        </Box>
      ))}
  </Box>
);

// The two-column body under a hero: wide content on the left, the user's own data (library,
// progress, tags, notes) on the right; one column on phones, or when there's no side content
// (a discovered game has nothing of the user's to show yet).
export const DetailColumns = ({ main, side }: { main: ReactNode; side: ReactNode }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        lg: side ? "minmax(0, 1.55fr) minmax(320px, 1fr)" : "minmax(0, 1fr)",
      },
      columnGap: 3.5,
      "& > *": { minWidth: 0 },
    }}
  >
    <Box>{main}</Box>
    <Box>{side}</Box>
  </Box>
);

// A section's own action, at the end of its title rule ("Add copy", "Edit", "Manage").
export const SectionAction = ({
  icon,
  label,
  onClick,
  to,
  ...rest
}: {
  icon: ReactNode;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  to?: string;
  "aria-haspopup"?: "menu";
}) => (
  <ButtonBase
    {...(to ? { component: Link, to } : { onClick })}
    {...rest}
    sx={{
      gap: 0.5,
      px: 0.75,
      py: 0.25,
      borderRadius: 1,
      fontSize: 12.5,
      fontWeight: 600,
      color: "text.secondary",
      whiteSpace: "nowrap",
      "& svg": { fontSize: 17 },
      "&:hover": { color: "primary.main", bgcolor: "vgt.accentSoft" },
    }}
  >
    {icon}
    {label}
  </ButtonBase>
);

// One line in a section's list (a copy, a platform's progress, a play session, a note): an
// optional badge, a title and a detail line, then chips and row actions at the end. The whole
// row opens it when `onClick` is set; row actions don't.
export const ListRow = ({
  leading,
  title,
  subtitle,
  trailing,
  actions,
  onClick,
  label,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  // The row's accessible name when it's clickable.
  label?: string;
}) => (
  <Box
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={onClick ? label : undefined}
    onClick={onClick}
    onKeyDown={(event) => {
      if (onClick && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick();
      }
    }}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 1.75,
      py: 1.25,
      minWidth: 0,
      cursor: onClick ? "pointer" : "default",
      "& + &": { borderTop: 1, borderColor: "divider" },
      "&:hover": onClick ? { bgcolor: "vgt.surfaceHover" } : undefined,
      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
    }}
  >
    {leading}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Box>
      {subtitle ? (
        <Box sx={{ color: "text.secondary", fontSize: 12.5, mt: 0.25, overflowWrap: "anywhere" }}>{subtitle}</Box>
      ) : null}
    </Box>
    {trailing ? <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>{trailing}</Box> : null}
    {actions ? (
      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, mr: -0.75 }} onClick={(event) => event.stopPropagation()}>
        {actions}
      </Box>
    ) : null}
  </Box>
);

// A row's own button (Move, Remove), with its name as a tooltip.
export const RowAction = ({ title, icon, onClick }: { title: string; icon: ReactNode; onClick: () => void }) => (
  <Tooltip title={title}>
    <IconButton size="small" aria-label={title} onClick={onClick} sx={{ color: "text.secondary" }}>
      {icon}
    </IconButton>
  </Tooltip>
);

// The short badge at the start of a copy or progress row ("PS5", "PC").
export const PlatformBadge = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      flexShrink: 0,
      minWidth: 44,
      maxWidth: 64,
      height: 30,
      px: 0.75,
      borderRadius: 1.5,
      bgcolor: "vgt.surface2",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "text.secondary",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Box>
);

// A section's "nothing here yet" line.
export const EmptyLine = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" sx={{ color: "vgt.text3", fontStyle: "italic" }}>
    {children}
  </Typography>
);
