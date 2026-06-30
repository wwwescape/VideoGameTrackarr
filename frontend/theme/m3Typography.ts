import type { ThemeOptions } from "@mui/material/styles";

type TypographyOptions = ThemeOptions["typography"];

// M3's type scale (role: size/line-height/weight), mapped onto the MUI variant names this
// app's components already use. Roboto is loaded via @fontsource/roboto (see index.tsx).
const fontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';

export const m3Typography: TypographyOptions = {
  fontFamily,
  h1: { fontFamily, fontSize: "3.5rem", lineHeight: 1.12, fontWeight: 400 }, // displayLarge
  h2: { fontFamily, fontSize: "2.8125rem", lineHeight: 1.15, fontWeight: 400 }, // displayMedium
  h3: { fontFamily, fontSize: "2.25rem", lineHeight: 1.22, fontWeight: 400 }, // displaySmall
  h4: { fontFamily, fontSize: "2rem", lineHeight: 1.25, fontWeight: 400 }, // headlineLarge
  h5: { fontFamily, fontSize: "1.75rem", lineHeight: 1.28, fontWeight: 400 }, // headlineMedium
  h6: { fontFamily, fontSize: "1.5rem", lineHeight: 1.33, fontWeight: 500 }, // headlineSmall
  subtitle1: { fontFamily, fontSize: "1.375rem", lineHeight: 1.27, fontWeight: 400 }, // titleLarge
  subtitle2: { fontFamily, fontSize: "1rem", lineHeight: 1.5, fontWeight: 500 }, // titleMedium
  body1: { fontFamily, fontSize: "1rem", lineHeight: 1.5, fontWeight: 400 }, // bodyLarge
  body2: { fontFamily, fontSize: "0.875rem", lineHeight: 1.43, fontWeight: 400 }, // bodyMedium
  caption: { fontFamily, fontSize: "0.75rem", lineHeight: 1.33, fontWeight: 400 }, // bodySmall
  button: { fontFamily, fontSize: "0.875rem", lineHeight: 1.43, fontWeight: 500, textTransform: "none" }, // labelLarge
  overline: {
    fontFamily,
    fontSize: "0.6875rem",
    lineHeight: 1.45,
    fontWeight: 500,
    textTransform: "uppercase",
  }, // labelSmall
};
