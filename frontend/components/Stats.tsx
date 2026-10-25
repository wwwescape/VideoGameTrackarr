import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { TFunction } from "i18next";

// Shared pieces for Overview and Insights: headline tiles, titled panels and single-series bar
// lists (one hue — the accent — since every bar measures the same thing).

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  // A route to open, or a handler (a filtered Games list).
  to?: string;
  onClick?: () => void;
  // Dimmed (a Needs attention tile with nothing to fix).
  quiet?: boolean;
}

export function formatPlaytime(minutes: number, t: TFunction): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return t("games.stats.playtimeMinutesShort", { minutes: remainder });
  return remainder === 0
    ? t("games.stats.playtimeHoursShort", { hours })
    : t("games.stats.playtimeHoursMinutesShort", { hours, minutes: remainder });
}

export const StatTile = ({ label, value, hint, icon, to, onClick, quiet }: StatTileProps) => {
  const linkProps = to ? { component: Link, to } : onClick ? { component: ButtonBase, onClick } : {};
  const isLink = Boolean(to || onClick);
  return (
    <Box
      {...linkProps}
      sx={{
        // A column from the top, whether the tile is a link, a button (which centres by
        // default) or plain.
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        textAlign: "left",
        p: 2,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        color: "inherit",
        textDecoration: "none",
        font: "inherit",
        opacity: quiet ? 0.6 : 1,
        "&:hover": isLink ? { borderColor: "vgt.borderStrong" } : undefined,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "vgt.text3", "& svg": { fontSize: 18 } }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
      <Typography component="div" sx={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.2, mt: 0.75 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" component="div" sx={{ color: "vgt.text3", mt: 0.25 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
};

export const TileGrid = ({ children, min = 170 }: { children: ReactNode; min?: number }) => (
  // Two columns on phones, where even the smallest minimum would leave one per row.
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(auto-fill, minmax(${min}px, 1fr))` },
      gap: 1.5,
    }}
  >
    {children}
  </Box>
);

interface StatPanelProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

// A titled, bordered block holding one breakdown.
export const StatPanel = ({ title, action, children }: StatPanelProps) => (
  <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
      <Typography variant="subtitle2" component="h3">
        {title}
      </Typography>
      {action}
    </Box>
    {children}
  </Box>
);

export const PanelGrid = ({ children, min = 320 }: { children: ReactNode; min?: number }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: `repeat(auto-fill, minmax(${min}px, 1fr))` },
      gap: 1.5,
      alignItems: "start",
      // Below a TileGrid in the same section.
      "* + &": { mt: 1.5 },
    }}
  >
    {children}
  </Box>
);

export interface BarRow {
  label: string;
  value: number;
  // Opens a filtered list.
  onClick?: () => void;
}

interface BarListProps {
  rows: BarRow[];
  empty: string;
  // Show at most this many, largest first; the rest fold into one "Other" row.
  limit?: number;
  otherLabel: string;
  format?: (value: number) => string;
}

export const BarList = ({ rows, empty, limit, otherLabel, format = String }: BarListProps) => {
  if (!rows.length) {
    return (
      <Typography variant="body2" sx={{ color: "vgt.text3" }}>
        {empty}
      </Typography>
    );
  }
  let shown = rows;
  if (limit && rows.length > limit) {
    const rest = rows.slice(limit - 1).reduce((total, row) => total + row.value, 0);
    shown = [...rows.slice(0, limit - 1), { label: otherLabel, value: rest }];
  }
  const max = Math.max(...shown.map((row) => row.value), 1);
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
      {shown.map((row) => (
        <Box component="li" key={row.label} title={`${row.label}: ${format(row.value)}`} sx={{ minWidth: 0 }}>
          <Box
            {...(row.onClick ? { component: ButtonBase, onClick: row.onClick } : {})}
            sx={{
              display: "block",
              width: "100%",
              textAlign: "left",
              font: "inherit",
              color: "inherit",
              borderRadius: 1,
              "&:hover .bar": row.onClick ? { opacity: 1 } : undefined,
              "&:hover .bar-label": row.onClick ? { color: "primary.main" } : undefined,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, fontSize: 13, mb: 0.5 }}>
              <Box component="span" className="bar-label" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.label}
              </Box>
              <Box component="span" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                {format(row.value)}
              </Box>
            </Box>
            <Box sx={{ height: 6, borderRadius: 1, bgcolor: "vgt.surface2" }}>
              <Box
                className="bar"
                sx={{
                  height: "100%",
                  width: `${Math.max((row.value / max) * 100, 2)}%`,
                  borderRadius: 1,
                  bgcolor: "primary.main",
                  opacity: 0.85,
                }}
              />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
