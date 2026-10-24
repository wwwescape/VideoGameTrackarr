import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
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
}

export const DetailHero = ({ backdrop, media, mediaWidth, crumbs, title, subline, pills }: DetailHeroProps) => (
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
      </Box>
    </Box>
  </Box>
);

interface PillProps {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "owned" | "accent" | "success" | "danger";
  href?: string;
  to?: string;
  title?: string;
}

const PILL_TONES = {
  owned: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "vgt.owned" },
  success: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "vgt.owned" },
  danger: { border: "rgba(229,83,75,.45)", bg: "rgba(229,83,75,.12)", color: "error.main" },
  accent: { border: "primary.main", bg: "vgt.accentSoft", color: "text.primary" },
} as const;

// Rounded fact chip in the hero (status, play status, platforms, series, links...).
export const Pill = ({ icon, children, tone, href, to, title }: PillProps) => {
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
        height: 28,
        px: 1.25,
        borderRadius: 3.5,
        fontSize: 12.5,
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

// The explanation line a section's card header used to carry, for content inside a Section.
export const SectionNote = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" sx={{ color: "text.secondary", px: 2, pt: 1.5 }}>
    {children}
  </Typography>
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

// A sideways-scrolling row of related items (add-ons, linked accessories, an event's games).
export const Strip = ({ columnWidth = 150, children }: { columnWidth?: number; children: ReactNode }) => (
  <Box
    sx={{
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: columnWidth,
      gap: 1.5,
      overflowX: "auto",
      pb: 1,
      scrollbarWidth: "thin",
    }}
  >
    {children}
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
