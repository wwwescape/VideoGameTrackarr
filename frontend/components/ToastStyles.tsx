import GlobalStyles from "@mui/material/GlobalStyles";
import { alpha, useTheme } from "@mui/material/styles";

// react-toastify's toasts in the redesign's look: a surface card with a hairline border and
// soft shadow (light and dark), the type shown by a coloured icon, a left stripe and a thin
// progress line rather than a fully coloured box.
const ToastStyles = () => {
  const theme = useTheme();
  const { vgt } = theme.palette;
  const tones = {
    success: vgt.owned,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
    info: theme.palette.info.main,
    default: theme.palette.primary.main,
  };

  return (
    <GlobalStyles
      styles={{
        ".Toastify__toast-container": {
          width: 380,
          padding: 0,
        },
        ".Toastify__toast-container--bottom-right": { bottom: 16, right: 16 },
        [theme.breakpoints.down("sm")]: {
          ".Toastify__toast-container, .Toastify__toast-container--bottom-right": {
            width: "auto",
            left: 12,
            right: 12,
            bottom: 12,
          },
          ".Toastify__toast-container .Toastify__toast": { marginBottom: 8, borderRadius: 12 },
        },
        ".Toastify__toast": {
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
          marginBottom: 10,
          padding: "12px 12px 14px 16px",
          borderRadius: 12,
          border: `1px solid ${vgt.borderStrong}`,
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily,
          fontSize: 13.5,
          lineHeight: 1.45,
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 12px 32px rgba(0, 0, 0, 0.45)"
              : "0 12px 28px rgba(15, 23, 42, 0.14)",
          // The type's colour down the left edge.
          "&::before": {
            content: '""',
            position: "absolute",
            inset: "0 auto 0 0",
            width: 3,
            background: tones.default,
          },
        },
        ".Toastify__toast-body": { padding: 0, margin: 0, alignItems: "flex-start", gap: 2 },
        ".Toastify__toast-icon": { width: 18, marginInlineEnd: 10, marginTop: 1 },
        ".Toastify__close-button": {
          color: vgt.text3,
          opacity: 1,
          alignSelf: "flex-start",
          marginLeft: 6,
          "&:hover, &:focus": { color: theme.palette.text.primary, opacity: 1 },
        },
        ".Toastify__progress-bar": { height: 2, opacity: 0.85, background: tones.default },
        ".Toastify__progress-bar--bg": { height: 2 },
        ...Object.fromEntries(
          (["success", "error", "warning", "info"] as const).flatMap((type) => [
            [`.Toastify__toast--${type}::before`, { background: tones[type] }],
            [`.Toastify__toast--${type} .Toastify__toast-icon svg`, { fill: tones[type] }],
            [`.Toastify__toast--${type} .Toastify__progress-bar`, { background: tones[type] }],
          ])
        ),
        ".Toastify__toast--default::before": { background: tones.default },
        // The Undo toast's button in the accent, as text.
        ".Toastify__toast .MuiButton-root": { color: theme.palette.primary.main, fontWeight: 600 },
        ".Toastify__toast-theme--dark, .Toastify__toast-theme--light": { background: theme.palette.background.paper },
        ".Toastify__toast-icon + div, .Toastify__toast-body > div:last-child": { minWidth: 0 },
        ".Toastify__toast:hover": { borderColor: alpha(theme.palette.text.primary, 0.2) },
      }}
    />
  );
};

export default ToastStyles;
