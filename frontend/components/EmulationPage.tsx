import { useRef, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { BiosAcceptedFile, BiosSystem, BiosUploadedFile } from "../api/types";
import { useBiosSystems, useDeleteBios, useUploadBios } from "../hooks/useLibrary";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import SettingsSubNav from "./SettingsSubNav";

interface BiosCardProps {
  system: BiosSystem;
  onDelete: (file: BiosUploadedFile) => void;
}

// One console's BIOS: which files the core looks for, which of them are uploaded, and
// whether each upload matches a known-good dump. Each accepted name has its own Upload
// button, and the picked file is sent under that exact name (the core finds it by name), so
// a dump saved as e.g. "SCPH1001.BIN" or "bios (usa).bin" doesn't need renaming by hand.
const BiosCard = ({ system, onDelete }: BiosCardProps) => {
  const { t } = useTranslation();
  const upload = useUploadBios();
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  const uploaded = new Map(system.uploadedFiles.map((file) => [file.filename, file]));

  const handleFile = async (file: File, filename: string) => {
    try {
      await upload.mutateAsync({ system: system.key, file: new File([file], filename, { type: file.type }) });
      toast.success(t("settings.emulation.uploadedToast", { name: filename }), TOAST_OPTIONS);
    } catch (error) {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      toast.error(typeof detail === "string" ? detail : t("settings.emulation.uploadErrorToast"), TOAST_OPTIONS);
    }
  };

  const statusChip = system.ready ? (
    <Chip size="small" color="success" label={t("settings.emulation.ready")} />
  ) : system.required ? (
    <Chip size="small" color="warning" label={t("settings.emulation.requiredMissing")} />
  ) : (
    <Chip size="small" variant="outlined" label={t("settings.emulation.optionalMissing")} />
  );

  const fileRow = (accepted: BiosAcceptedFile) => {
    const file = uploaded.get(accepted.filename);
    const busy = upload.isPending && target === accepted.filename;
    return (
      <Box key={accepted.filename} data-testid={`bios-file-${accepted.filename}`} sx={{ py: 1 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
            {accepted.filename}
          </Typography>
          {file ? (
            file.recognized ? (
              <Chip size="small" color="success" variant="outlined" label={t("settings.emulation.recognized")} />
            ) : (
              <Tooltip
                title={
                  accepted.hasReferenceHash
                    ? t("settings.emulation.unrecognizedTooltip")
                    : t("settings.emulation.noReferenceTooltip")
                }
              >
                <Chip size="small" color="warning" variant="outlined" label={t("settings.emulation.unrecognized")} />
              </Tooltip>
            )
          ) : null}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            startIcon={busy ? <CircularProgress size={14} /> : <UploadFileIcon />}
            disabled={upload.isPending}
            onClick={() => {
              setTarget(accepted.filename);
              inputRef.current?.click();
            }}
            aria-label={t("settings.emulation.uploadAria", { name: accepted.filename })}
          >
            {file ? t("settings.emulation.replace") : t("settings.emulation.upload")}
          </Button>
          {file ? (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={upload.isPending}
              onClick={() => onDelete(file)}
              aria-label={t("settings.emulation.deleteAria", { name: accepted.filename })}
            >
              {t("common.delete")}
            </Button>
          ) : null}
        </Stack>
        {accepted.note || !accepted.satisfies ? (
          <Typography variant="caption" color="text.secondary" component="div">
            {[accepted.note, accepted.satisfies ? null : t("settings.emulation.extraFile")].filter(Boolean).join(" · ")}
          </Typography>
        ) : null}
        {file ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
          >
            {formatFileSize(file.sizeBytes)} · MD5 {file.md5}
          </Typography>
        ) : null}
      </Box>
    );
  };

  return (
    <Card variant="outlined" data-testid={`bios-system-${system.key}`}>
      <CardHeader
        title={system.label}
        subheader={t("settings.emulation.usedFor", { systems: system.systems.join(", ") })}
        action={<Box sx={{ pt: 1, pr: 1 }}>{statusChip}</Box>}
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {system.required
            ? system.acceptedFiles.filter((file) => file.satisfies).length > 1
              ? t("settings.emulation.requiredAnyHint")
              : t("settings.emulation.requiredHint")
            : t("settings.emulation.optionalHint")}
        </Typography>
        <Divider />
        {system.acceptedFiles.map(fileRow)}
        <input
          ref={inputRef}
          type="file"
          hidden
          data-testid={`bios-input-${system.key}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file && target) void handleFile(file, target);
          }}
        />
      </CardContent>
    </Card>
  );
};

// Settings → Emulation: the BIOS files some emulator cores need (Sega CD, Saturn, 3DO, Lynx,
// …), uploaded by the user from their own consoles — VideoGameTrackarr never ships or
// downloads them.
const EmulationPage = () => {
  const { t } = useTranslation();
  const { data: systems, isLoading, isError } = useBiosSystems();
  const deleteBios = useDeleteBios();
  const [pendingDelete, setPendingDelete] = useState<BiosUploadedFile | null>(null);

  const sorted = [...(systems ?? [])].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.emulation")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("settings.emulation.description")}
        </Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        {t("settings.emulation.legalNote")}
      </Alert>
      {isLoading ? (
        <CircularProgress />
      ) : isError ? (
        <Alert severity="error">{t("settings.emulation.loadError")}</Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            alignItems: "start",
          }}
        >
          {sorted.map((system) => (
            <BiosCard key={system.key} system={system} onDelete={setPendingDelete} />
          ))}
        </Box>
      )}
      <ConfirmDialog
        open={pendingDelete != null}
        title={t("settings.emulation.deleteTitle")}
        description={t("settings.emulation.deleteDescription", { name: pendingDelete?.filename ?? "" })}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          const file = pendingDelete;
          setPendingDelete(null);
          if (!file) return;
          deleteBios.mutate(file.id, {
            onError: () => toast.error(t("settings.emulation.deleteErrorToast"), TOAST_OPTIONS),
          });
        }}
      />
    </>
  );
};

export default EmulationPage;
