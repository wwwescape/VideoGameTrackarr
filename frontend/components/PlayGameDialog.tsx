import { useState } from "react";
import HistoryIcon from "@mui/icons-material/History";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { createPlaySession } from "../api/library";
import type { EmulatorSession, LibraryItem, RomFileSummary, SaveState } from "../api/types";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import EmulatorPlayerDialog from "./EmulatorPlayerDialog";
import SaveStatePickerDialog from "./SaveStatePickerDialog";

interface PlayGameDialogProps {
  open: boolean;
  gameName: string;
  libraryItems: LibraryItem[];
  onClose: () => void;
}

interface RomRow {
  item: LibraryItem;
  rom: RomFileSummary;
}

interface ActiveSession {
  session: EmulatorSession;
  title: string;
  romId: number;
  resumeStateId: number | null;
}

// Every ROM uploaded for this title, grouped by platform (a game can have a different ROM
// per platform copy), each with its own Play button — plus Resume… when it has server-side
// save states. Same size as the Filters & More and bulk Tags dialogs.
const PlayGameDialog = ({ open, gameName, libraryItems, onClose }: PlayGameDialogProps) => {
  const { t } = useTranslation();
  const [startingRomId, setStartingRomId] = useState<number | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [resumeRow, setResumeRow] = useState<RomRow | null>(null);

  const groups = new Map<string, RomRow[]>();
  for (const item of libraryItems) {
    if (item.status !== "owned" || !item.rom) continue;
    const platform = item.platformName ?? t("games.play.unknownPlatform");
    groups.set(platform, [...(groups.get(platform) ?? []), { item, rom: item.rom }]);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  const typeLabel = (rom: RomFileSummary) =>
    rom.isArchive && rom.extension !== "zip"
      ? `ZIP (${rom.extension.toUpperCase()})`
      : rom.extension.toUpperCase();

  const unplayableLabel = (rom: RomFileSummary) =>
    rom.unplayableReason === "unsupported_platform"
      ? t("games.play.unsupportedPlatform")
      : t("games.play.unsupportedFileType");

  const savesLabel = (rom: RomFileSummary) =>
    [
      rom.saveStateCount > 0 ? t("games.play.saveStateCount", { count: rom.saveStateCount }) : null,
      rom.hasInGameSave ? t("games.play.hasInGameSave") : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const handlePlay = async ({ item, rom }: RomRow, resumeFrom: SaveState | null = null) => {
    setStartingRomId(rom.id);
    try {
      const playSession = await createPlaySession(rom.id);
      setSession({
        session: playSession,
        title: item.platformName ? `${gameName} (${item.platformName})` : gameName,
        romId: rom.id,
        resumeStateId: resumeFrom?.id ?? null,
      });
    } catch (error) {
      console.error("Error starting play session:", error);
      toast.error(t("games.play.startErrorToast"), TOAST_OPTIONS);
    } finally {
      setStartingRomId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>{t("games.play.dialogTitle", { name: gameName })}</DialogTitle>
        <DialogContent dividers>
          {sortedGroups.length === 0 ? (
            <Box sx={{ py: 2 }}>{t("games.play.noRoms")}</Box>
          ) : (
            <List disablePadding>
              {sortedGroups.map(([platform, rows]) => (
                <li key={platform}>
                  <ul style={{ padding: 0 }}>
                    <ListSubheader disableSticky sx={{ px: 0 }}>
                      {platform}
                    </ListSubheader>
                    {rows.map((row) => (
                      <ListItem
                        key={row.rom.id}
                        disableGutters
                        secondaryAction={
                          row.rom.playable ? (
                            <Stack direction="row" spacing={1}>
                              {row.rom.saveStateCount > 0 ? (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<HistoryIcon />}
                                  disabled={startingRomId != null}
                                  onClick={() => setResumeRow(row)}
                                  aria-label={t("games.play.resumeRomAria", {
                                    name: row.rom.originalFilename,
                                  })}
                                >
                                  {t("games.play.resumeButton")}
                                </Button>
                              ) : null}
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<PlayArrowIcon />}
                                disabled={startingRomId != null}
                                onClick={() => void handlePlay(row)}
                                aria-label={t("games.play.playRomAria", {
                                  name: row.rom.originalFilename,
                                })}
                              >
                                {t("games.play.playButton")}
                              </Button>
                            </Stack>
                          ) : (
                            <Tooltip title={unplayableLabel(row.rom)}>
                              {/* span: a disabled button doesn't fire hover events itself */}
                              <span>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<PlayArrowIcon />}
                                  disabled
                                >
                                  {t("games.play.playButton")}
                                </Button>
                              </span>
                            </Tooltip>
                          )
                        }
                        sx={{ pr: row.rom.playable && row.rom.saveStateCount > 0 ? 28 : 14 }}
                      >
                        <ListItemText
                          primary={row.rom.originalFilename}
                          secondary={[
                            formatFileSize(row.rom.sizeBytes),
                            typeLabel(row.rom),
                            row.rom.playable ? null : unplayableLabel(row.rom),
                            savesLabel(row.rom) || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          slotProps={{ primary: { sx: { wordBreak: "break-all" } } }}
                        />
                      </ListItem>
                    ))}
                  </ul>
                </li>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
      <SaveStatePickerDialog
        open={resumeRow != null}
        romId={resumeRow?.rom.id ?? null}
        title={t("games.play.resumeTitle", { name: resumeRow?.rom.originalFilename ?? "" })}
        loadLabel={t("games.play.resumeButton")}
        onLoad={(state) => {
          const row = resumeRow;
          setResumeRow(null);
          if (row) void handlePlay(row, state);
        }}
        onClose={() => setResumeRow(null)}
      />
      <EmulatorPlayerDialog
        open={session != null}
        title={session?.title ?? ""}
        session={session?.session ?? null}
        romId={session?.romId ?? null}
        resumeStateId={session?.resumeStateId ?? null}
        onClose={() => setSession(null)}
      />
    </>
  );
};

export default PlayGameDialog;
