import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";
import { useMarkWhatsNewSeen, useWhatsNew } from "../hooks/useVersion";
import MarkdownText from "./MarkdownText";

// After an upgrade, the release notes of every version you haven't seen yet, newest first,
// once per account: closing it records the running version as seen on the server, so no other
// browser or phone shows it again. A new install has nothing to show (see the backend's
// version_service.get_whats_new). When GitHub can't be reached, it links to the release.
const WhatsNewDialog = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { data } = useWhatsNew();
  const markSeen = useMarkWhatsNewSeen();

  const open = Boolean(data && (data.releases.length > 0 || data.notesUnavailable));
  if (!data || !open) return null;

  const close = () => markSeen.mutate();
  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, { day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <Dialog open onClose={close} fullScreen={fullScreen} fullWidth maxWidth="sm" scroll="paper" aria-labelledby="whats-new-title">
      <DialogTitle id="whats-new-title" sx={{ pb: 0.5 }}>
        {t("whatsNew.title")}
        <Typography variant="body2" color="text.secondary">
          {t("whatsNew.updatedTo", { version: data.currentVersion })}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {data.notesUnavailable ? (
          <Typography variant="body2" color="text.secondary">
            {t("whatsNew.notesUnavailable")}{" "}
            <Link href={data.releaseUrl} target="_blank" rel="noopener noreferrer">
              {t("whatsNew.openReleaseNotes")}
            </Link>
          </Typography>
        ) : (
          data.releases.map((release, index) => (
            <Box key={release.version} component="section" sx={{ pt: index ? 2.5 : 0, mt: index ? 2.5 : 0, borderTop: index ? 1 : 0, borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 1, mb: 1.25 }}>
                <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
                  {release.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(release.publishedAt)}
                </Typography>
                <Link
                  href={release.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="caption"
                  sx={{ ml: "auto", display: "inline-flex", alignItems: "center", gap: 0.25 }}
                >
                  {t("whatsNew.viewOnGithub")}
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              </Box>
              <MarkdownText text={release.body} repoUrl={release.url.split("/releases/")[0]} />
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={close} disabled={markSeen.isPending}>
          {t("whatsNew.gotIt")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WhatsNewDialog;
