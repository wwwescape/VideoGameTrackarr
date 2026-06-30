import { createTheme, type Theme } from "@mui/material/styles";
import { buildM3Scheme, type ColorMode, type ContrastLevel } from "./m3Colors";
import { m3ShapeScale } from "./m3Shape";
import { m3Typography } from "./m3Typography";

// M3 color roles MUI's own Palette/PaletteOptions interfaces don't have a home for
// (everything beyond primary/secondary/error/background/text/divider, which map onto
// MUI's standard fields below instead).
export interface M3ExtraColorRoles {
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  errorContainer: string;
  onErrorContainer: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  shadow: string;
  scrim: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    m3: M3ExtraColorRoles;
  }
  interface PaletteOptions {
    m3?: M3ExtraColorRoles;
  }
  interface Theme {
    m3Shape: typeof m3ShapeScale;
  }
  interface ThemeOptions {
    m3Shape?: typeof m3ShapeScale;
  }
}

export function createM3Theme(mode: ColorMode, contrast: ContrastLevel): Theme {
  const scheme = buildM3Scheme(mode, contrast);

  return createTheme({
    palette: {
      mode,
      primary: { main: scheme.primary, contrastText: scheme.onPrimary },
      secondary: { main: scheme.secondary, contrastText: scheme.onSecondary },
      error: { main: scheme.error, contrastText: scheme.onError },
      background: { default: scheme.background, paper: scheme.surface },
      text: { primary: scheme.onSurface, secondary: scheme.onSurfaceVariant },
      divider: scheme.outlineVariant,
      m3: {
        tertiary: scheme.tertiary,
        onTertiary: scheme.onTertiary,
        tertiaryContainer: scheme.tertiaryContainer,
        onTertiaryContainer: scheme.onTertiaryContainer,
        primaryContainer: scheme.primaryContainer,
        onPrimaryContainer: scheme.onPrimaryContainer,
        secondaryContainer: scheme.secondaryContainer,
        onSecondaryContainer: scheme.onSecondaryContainer,
        errorContainer: scheme.errorContainer,
        onErrorContainer: scheme.onErrorContainer,
        surfaceVariant: scheme.surfaceVariant,
        onSurfaceVariant: scheme.onSurfaceVariant,
        outline: scheme.outline,
        outlineVariant: scheme.outlineVariant,
        inverseSurface: scheme.inverseSurface,
        inverseOnSurface: scheme.inverseOnSurface,
        inversePrimary: scheme.inversePrimary,
        shadow: scheme.shadow,
        scrim: scheme.scrim,
      },
    },
    typography: m3Typography,
    shape: { borderRadius: m3ShapeScale.medium },
    m3Shape: m3ShapeScale,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // A consistent, high-contrast focus ring across every interactive element —
          // browser defaults vary a lot and some are barely visible against custom
          // theme colors. :focus-visible (not :focus) so it only shows for keyboard/
          // assistive-tech navigation, not every mouse click.
          "*:focus-visible": {
            outline: `3px solid ${scheme.primary}`,
            outlineOffset: 2,
          },
        },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: m3ShapeScale.large } },
      },
      MuiPaper: {
        styleOverrides: { root: { borderRadius: m3ShapeScale.medium } },
      },
      // AppBar is Paper-based under the hood, so without this it inherits the same
      // rounded corners as cards/dialogs — wrong for a fixed, full-width top bar with
      // nothing to round against; it just exposes the page background behind the cutout.
      MuiAppBar: {
        styleOverrides: { root: { borderRadius: 0 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: m3ShapeScale.extraLarge } },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: m3ShapeScale.full, paddingInline: 20 },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: m3ShapeScale.small } },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined" },
      },
    },
  });
}
