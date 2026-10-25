import { alpha, createTheme, getContrastRatio, type Theme } from "@mui/material/styles";
import type { ColorMode, ContrastLevel } from "./colors";

// The 2026 redesign's look, shared with DieCastCollectionTracker: compact and flat. Fixed
// slate surfaces in dark mode and near-white ones in light mode, 1px borders instead of
// shadows, Inter at a 14px base, 8px corners, and a single accent — the user's accent color
// from Settings → Display — used as-is for primary actions, highlights and the active nav item.

export interface VgtTokens {
  // App chrome: sidebar and header.
  shell: string;
  // Raised surfaces: cards, panels, menus.
  surface: string;
  // Inputs, chips, table hover rows.
  surface2: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  // Tertiary text: captions, counts, empty-state hints.
  text3: string;
  owned: string;
  wishlist: string;
  accentSoft: string;
  // Badges and chips that sit on cover art keep one dark glass look in both themes, so they
  // read on any cover.
  glass: string;
  glassLine: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    vgt: VgtTokens;
  }
  interface PaletteOptions {
    vgt?: VgtTokens;
  }
}

const DARK = {
  background: "#15181e",
  shell: "#1b1f26",
  surface: "#20252d",
  surface2: "#272d36",
  surfaceHover: "#2c333d",
  border: "#2f3640",
  borderStrong: "#3b434f",
  text: "#e6e9ee",
  text2: "#a4acb8",
  text3: "#7d8794",
};

const LIGHT = {
  background: "#f4f6f9",
  shell: "#ffffff",
  surface: "#ffffff",
  surface2: "#f0f2f6",
  surfaceHover: "#e9edf2",
  border: "#e0e4ea",
  borderStrong: "#cfd5de",
  text: "#1a1f27",
  text2: "#566070",
  text3: "#7c8593",
};

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const RADIUS = 8;

// White text on the accent when it reaches 3:1 (large/bold UI text), else near-black, so
// light presets like yellow stay readable.
export const accentContrastText = (accent: string) =>
  getContrastRatio(accent, "#ffffff") >= 3 ? "#ffffff" : "#111418";

export function createVgtTheme(mode: ColorMode, contrast: ContrastLevel, accent: string): Theme {
  const base = mode === "dark" ? DARK : LIGHT;
  const high = contrast === "high";
  const tokens = {
    ...base,
    // High contrast: stronger borders and secondary text, nothing else moves.
    border: high ? base.borderStrong : base.border,
    borderStrong: high ? (mode === "dark" ? "#5a6472" : "#9aa4b2") : base.borderStrong,
    text2: high ? base.text : base.text2,
    text3: high ? base.text2 : base.text3,
  };
  const onAccent = accentContrastText(accent);

  return createTheme({
    palette: {
      mode,
      primary: { main: accent, contrastText: onAccent },
      secondary: { main: mode === "dark" ? "#9aa4b2" : "#566070" },
      success: { main: "#3fb27f" },
      error: { main: "#e5534b" },
      warning: { main: "#e0a43a" },
      info: { main: accent, contrastText: onAccent },
      background: { default: tokens.background, paper: tokens.surface },
      text: { primary: tokens.text, secondary: tokens.text2 },
      divider: tokens.border,
      action: {
        hover: tokens.surfaceHover,
        selected: alpha(accent, 0.16),
      },
      vgt: {
        shell: tokens.shell,
        surface: tokens.surface,
        surface2: tokens.surface2,
        surfaceHover: tokens.surfaceHover,
        border: tokens.border,
        borderStrong: tokens.borderStrong,
        text3: tokens.text3,
        owned: "#3fb27f",
        wishlist: "#ff6b8b",
        accentSoft: alpha(accent, 0.16),
        glass: "rgba(10, 12, 16, 0.74)",
        glassLine: "rgba(255, 255, 255, 0.16)",
      },
    },
    shape: { borderRadius: RADIUS },
    typography: {
      fontFamily: FONT,
      fontSize: 14,
      h1: { fontSize: "2.25rem", fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.15 },
      h2: { fontSize: "1.875rem", fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.15 },
      h3: { fontSize: "1.5rem", fontWeight: 650, letterSpacing: "-0.015em", lineHeight: 1.2 },
      h4: { fontSize: "1.375rem", fontWeight: 650, letterSpacing: "-0.015em", lineHeight: 1.25 },
      h5: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3 },
      h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.35 },
      subtitle1: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.4 },
      subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
      caption: { fontSize: "0.75rem", lineHeight: 1.4 },
      button: { fontSize: "0.8125rem", fontWeight: 600, textTransform: "none" },
      overline: {
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.08em",
        lineHeight: 1.6,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Native scrollbars, form controls and the like follow the mode, as in the mockups,
          // instead of staying light on dark pages.
          html: { colorScheme: mode },
          body: { backgroundColor: tokens.background },
          // One consistent, visible focus ring for keyboard users. :focus-visible (not
          // :focus) so it only shows for keyboard/assistive-tech navigation.
          "*:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2 },
          "::selection": { backgroundColor: alpha(accent, 0.3) },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: { borderColor: tokens.border },
          // Elevation 0 Paper (cards, panels) gets a hairline border instead of a shadow.
          elevation0: { border: `1px solid ${tokens.border}` },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: `1px solid ${tokens.border}`, borderRadius: RADIUS } },
      },
      // Paper-based, so without this the full-width bars would pick up the hairline border on
      // every side; they draw their own bottom border.
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: 0, borderRadius: 0 } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { border: 0, borderRadius: 0 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.borderStrong}`,
            boxShadow: "0 12px 32px rgba(0,0,0,.28)",
          },
          list: { padding: 6 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { borderRadius: 6, minHeight: 34, fontSize: "0.875rem" },
        },
      },
      MuiPopover: {
        styleOverrides: { paper: { border: `1px solid ${tokens.borderStrong}` } },
      },
      MuiAutocomplete: {
        defaultProps: { size: "small" },
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.borderStrong}`,
            boxShadow: "0 12px 32px rgba(0,0,0,.28)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${tokens.borderStrong}` },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: "1.0625rem", fontWeight: 600 } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 6, paddingInline: 14, minHeight: 34 },
          sizeSmall: { minHeight: 28, paddingInline: 10 },
          outlined: { borderColor: tokens.borderStrong },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 500 },
          outlined: { borderColor: tokens.borderStrong },
        },
      },
      MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface2,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.borderStrong },
          },
        },
      },
      MuiTabs: { styleOverrides: { root: { minHeight: 40 } } },
      MuiTab: {
        styleOverrides: { root: { minHeight: 40, textTransform: "none", fontWeight: 600 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: "0.75rem",
            backgroundColor: mode === "dark" ? "#0b0d10" : "#1a1f27",
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600, borderColor: tokens.border },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: tokens.border, paddingTop: 7, paddingBottom: 7 },
          head: { color: tokens.text3, fontWeight: 600, fontSize: "0.75rem" },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: RADIUS } } },
    },
  });
}
