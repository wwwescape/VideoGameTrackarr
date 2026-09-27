import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { createPlaySession } from "../api/library";
import type { EmulatorSession } from "../api/types";
import EmulatorPlayerDialog from "./EmulatorPlayerDialog";

function readParams(search: string) {
  const params = new URLSearchParams(search);
  const romId = Number(params.get("rom"));
  const resume = params.get("resume");
  return {
    romId: Number.isInteger(romId) && romId > 0 ? romId : null,
    resumeStateId: resume != null && /^\d+$/.test(resume) ? Number(resume) : null,
    title: params.get("title") ?? "",
  };
}

// The whole of player-isolated.html: the DOS/PSP player in its own tab. Threaded cores need
// SharedArrayBuffer, which a page only gets when it's cross-origin isolated (served with
// COOP/COEP — see backend/app/main.py and vite.config.ts), and the main app can't be (it
// loads IGDB cover art and other cross-origin images). This page starts its own play session
// and hosts the same player iframe and save handling as the in-app Play dialog.
const IsolatedPlayerPage = () => {
  const { t } = useTranslation();
  const [{ romId, resumeStateId, title }] = useState(() => readParams(window.location.search));
  const [session, setSession] = useState<EmulatorSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const isolated = window.crossOriginIsolated === true;

  useEffect(() => {
    document.title = title ? `${title} · VideoGameTrackarr` : "VideoGameTrackarr";
  }, [title]);

  useEffect(() => {
    if (romId == null || !isolated) return;
    let cancelled = false;
    createPlaySession(romId)
      .then((created) => {
        if (!cancelled) setSession(created);
      })
      .catch((err: unknown) => {
        console.error("Error starting play session:", err);
        if (!cancelled) setError(t("games.play.startErrorToast"));
      });
    return () => {
      cancelled = true;
    };
  }, [romId, isolated, t]);

  const message = (() => {
    if (closed) return <Typography>{t("games.play.tabClosedMessage")}</Typography>;
    if (romId == null) return <Alert severity="error">{t("games.play.invalidLink")}</Alert>;
    if (!isolated) return <Alert severity="error">{t("games.play.notIsolated")}</Alert>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!session) return <CircularProgress aria-label={t("common.loading")} />;
    return null;
  })();

  return (
    <>
      {message ? (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
          {message}
        </Box>
      ) : null}
      <EmulatorPlayerDialog
        open={session != null && !closed}
        title={title}
        session={session}
        romId={romId}
        resumeStateId={resumeStateId}
        onClose={() => {
          setClosed(true);
          // Allowed because this tab was opened by the Play dialog's window.open.
          window.close();
        }}
      />
    </>
  );
};

export default IsolatedPlayerPage;
