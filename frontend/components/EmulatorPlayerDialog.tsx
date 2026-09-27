import { useCallback, useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { createSaveState, getInGameSave, getSaveStateData, putInGameSave } from "../api/library";
import type { EmulatorSession, SaveState } from "../api/types";
import { useInvalidateRomSaves } from "../hooks/useLibrary";
import SaveStatePickerDialog from "./SaveStatePickerDialog";

interface EmulatorPlayerDialogProps {
  open: boolean;
  title: string;
  session: EmulatorSession | null;
  romId: number | null;
  // Start from this server-side save state once the game has booted (Play Game → Resume…).
  resumeStateId?: number | null;
  onClose: () => void;
}

// How long closing waits for the player's final in-game save to reach the server.
const FLUSH_TIMEOUT_MS = 3000;

type PlayerMessage =
  | { type: "vgt:started" }
  | { type: "vgt:saveState"; state: Uint8Array<ArrayBuffer>; screenshot: Blob | null }
  | { type: "vgt:loadStateRequest" }
  | { type: "vgt:sram"; bytes: Uint8Array<ArrayBuffer> }
  | { type: "vgt:flushed" };

function sameBytes(a: Uint8Array<ArrayBuffer> | null, b: Uint8Array<ArrayBuffer>): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const withTimeout = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

// Fullscreen host for the standalone EmulatorJS page (public/emulatorjs/player.html). The
// iframe is only mounted while open, so closing the dialog tears the emulator (and its WASM
// core) down completely rather than leaving it running in the background.
//
// Saves: the iframe never talks to the API itself. It postMessages save events here
// (see player.js), and this component — which already has the app's Bearer token and its
// refresh handling — uploads them, loads the in-game save back in on start, and opens the
// save state picker when the in-game Load State button is pressed.
const EmulatorPlayerDialog = ({
  open,
  title,
  session,
  romId,
  resumeStateId = null,
  onClose,
}: EmulatorPlayerDialogProps) => {
  const { t, i18n } = useTranslation();
  const invalidateSaves = useInvalidateRomSaves();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Uploads run one at a time, in order, so a close can wait for all of them.
  const uploadQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastSram = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const flushResolver = useRef<(() => void) | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Toasts render above MUI dialogs in the top-right corner — exactly where this dialog's
  // close button sits — so clear any lingering ones (e.g. "copy saved") as the player opens.
  useEffect(() => {
    if (open) {
      toast.dismiss();
      lastSram.current = null;
      uploadQueue.current = Promise.resolve();
    }
  }, [open, session]);

  const post = useCallback((message: object, transfer: Transferable[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin, transfer);
  }, []);

  const enqueue = useCallback((task: () => Promise<void>) => {
    uploadQueue.current = uploadQueue.current.then(task).catch((error) => {
      console.error("Error syncing save:", error);
    });
    return uploadQueue.current;
  }, []);

  const loadStateIntoPlayer = useCallback(
    async (stateId: number) => {
      if (romId == null) return;
      const data = new Uint8Array(await getSaveStateData(romId, stateId));
      post({ type: "vgt:loadState", bytes: data }, [data.buffer]);
    },
    [romId, post]
  );

  useEffect(() => {
    if (!open || romId == null) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const message = event.data as PlayerMessage | undefined;
      if (!message || typeof message.type !== "string") return;

      switch (message.type) {
        case "vgt:started":
          void (async () => {
            try {
              const sram = await getInGameSave(romId);
              if (sram) {
                const bytes = new Uint8Array(sram);
                lastSram.current = bytes.slice();
                post({ type: "vgt:loadSram", bytes }, [bytes.buffer]);
              }
              if (resumeStateId != null) {
                await loadStateIntoPlayer(resumeStateId);
              }
            } catch (error) {
              console.error("Error restoring saves:", error);
              post({ type: "vgt:message", text: t("games.play.restoreSavesFailed") });
            }
          })();
          break;
        case "vgt:saveState":
          void enqueue(async () => {
            try {
              await createSaveState(romId, new Blob([message.state]), message.screenshot);
              invalidateSaves(romId);
              post({ type: "vgt:message", text: t("games.play.stateSavedMessage") });
            } catch (error) {
              post({ type: "vgt:message", text: t("games.play.stateSaveFailedMessage") });
              throw error;
            }
          });
          break;
        case "vgt:loadStateRequest":
          setPickerOpen(true);
          break;
        case "vgt:sram":
          void enqueue(async () => {
            // The player reports the in-game save on every interval tick, changed or not.
            if (sameBytes(lastSram.current, message.bytes)) return;
            const bytes = message.bytes.slice();
            await putInGameSave(romId, new Blob([bytes]));
            lastSram.current = bytes;
            invalidateSaves(romId);
          });
          break;
        case "vgt:flushed":
          flushResolver.current?.();
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, romId, resumeStateId, post, enqueue, invalidateSaves, loadStateIntoPlayer, t]);

  // Closing asks the player to write out its in-game save one last time and waits (briefly)
  // for that upload before unmounting the iframe — otherwise anything saved in-game since the
  // last interval tick would be lost.
  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const flushed = new Promise<void>((resolve) => {
        flushResolver.current = resolve;
      });
      post({ type: "vgt:flush" });
      await withTimeout(flushed, FLUSH_TIMEOUT_MS);
      await withTimeout(uploadQueue.current, FLUSH_TIMEOUT_MS);
    } finally {
      flushResolver.current = null;
      setClosing(false);
      setPickerOpen(false);
      onClose();
    }
  };

  const handlePickState = async (state: SaveState) => {
    setPickerOpen(false);
    try {
      await loadStateIntoPlayer(state.id);
    } catch (error) {
      console.error("Error loading save state:", error);
      post({ type: "vgt:message", text: t("games.play.stateLoadFailedMessage") });
    }
  };

  const src = session
    ? `/emulatorjs/player.html?${new URLSearchParams({
        // Absolute in dev, where the API is on :8000 but this page (and the player) on :3000.
        rom: resolveAssetUrl(session.romUrl) ?? session.romUrl,
        core: session.core,
        name: session.gameName,
        lang: i18n.language,
        ...(session.biosFiles.length > 0
          ? {
              bios: JSON.stringify(
                session.biosFiles.map((file) => ({ filename: file.filename, url: resolveAssetUrl(file.url) ?? file.url }))
              ),
            }
          : {}),
        ...(Object.keys(session.coreOptions).length > 0 ? { options: JSON.stringify(session.coreOptions) } : {}),
        // Only inside player-isolated.html (cross-origin isolated), where threaded cores work.
        ...(session.isolated && window.crossOriginIsolated ? { threads: "1" } : {}),
      }).toString()}`
    : null;

  return (
    <Dialog open={open} onClose={() => void handleClose()} fullScreen>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {title}
          </Typography>
          {closing ? (
            <Tooltip title={t("games.play.savingOnClose")}>
              <CircularProgress
                size={20}
                sx={{ mr: 1.5 }}
                aria-label={t("games.play.savingOnClose")}
              />
            </Tooltip>
          ) : null}
          <IconButton
            edge="end"
            onClick={() => void handleClose()}
            disabled={closing}
            aria-label={t("games.play.closePlayerAria")}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, bgcolor: "#000", display: "flex" }}>
        {open && src ? (
          <Box
            component="iframe"
            ref={iframeRef}
            title={title}
            src={src}
            allow="fullscreen; gamepad; autoplay; screen-wake-lock"
            allowFullScreen
            sx={{ border: 0, width: "100%", height: "100%", flex: 1 }}
          />
        ) : null}
      </Box>
      <SaveStatePickerDialog
        open={pickerOpen}
        romId={romId}
        title={t("games.play.loadStateTitle")}
        loadLabel={t("games.play.loadStateButton")}
        onLoad={(state) => void handlePickState(state)}
        onClose={() => setPickerOpen(false)}
      />
    </Dialog>
  );
};

export default EmulatorPlayerDialog;
