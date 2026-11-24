import { lazy, Suspense, useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { createGuideDownloadLink } from "../api/guides";
import type { Guide, LibraryItem, PlatformResponse } from "../api/types";
import { useDeleteGuide, useGuides } from "../hooks/useGuides";
import CheatIcon from "../icons/CheatIcon";
import GuideIcon from "../icons/GuideIcon";
import { downloadFromUrl } from "../utils/download";
import { formatFileSize } from "../utils/fileSize";
import { serverDetail } from "../utils/guideLinks";
import { forgetGuidePosition } from "../utils/guideReaderPosition";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { EmptyLine, ListRow, Panel, RowAction, Section, SectionAction } from "./Detail";
import GuideDialog from "./GuideDialog";

// The reader (and pdf.js inside it) is only fetched when a guide is first opened.
const GuideReader = lazy(() => import("./guideReader/GuideReader"));

const READER_HASH = /^#guides\/(\d+)$/;

interface GuidesCheatsSectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  gamePlatforms: PlatformResponse[] | undefined;
}

// The type tile at the start of a row: a Guide (primary) or a Cheat (secondary) icon.
const KindTile = ({ guide }: { guide: Guide }) => {
  const { t } = useTranslation();
  const label = t(`guides.kind.${guide.kind}`);
  const Icon = guide.kind === "cheat" ? CheatIcon : GuideIcon;
  return (
    <Tooltip title={label}>
      <Box
        role="img"
        aria-label={label}
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "vgt.surface2",
          color: guide.kind === "cheat" ? "secondary.main" : "primary.main",
        }}
      >
        <Icon fontSize="small" />
      </Box>
    </Tooltip>
  );
};

// A Guides & Cheats row's detail line: format · size · platform for a file, the site for a
// link, "File missing" for a file that isn't on the server.
const GuideSubtitle = ({ guide }: { guide: Guide }) => {
  const { t } = useTranslation();
  const platform = guide.platformName;
  if (guide.source === "link") {
    return (
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}
      >
        <LinkOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />
        {[guide.domain, platform].filter(Boolean).join(" · ")}
      </Box>
    );
  }
  if (guide.fileMissing) {
    return (
      <>
        <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>
          {t("guides.fileMissing")}
        </Box>
        {platform ? ` · ${platform}` : null}
      </>
    );
  }
  const parts = [
    guide.mediaFormat ? t(`guides.format.${guide.mediaFormat}`) : null,
    guide.sizeBytes != null ? formatFileSize(guide.sizeBytes) : null,
    platform,
  ];
  return <>{parts.filter(Boolean).join(" · ")}</>;
};

// A game's Guides & Cheats: uploaded guides and cheat sheets (PDF, Word, Markdown, text) and
// saved links, as rows like the library's. A file opens in the in-app reader, a link opens its
// page in a new tab; each can be downloaded or opened, edited and deleted. The reader's open
// guide is the page's `#guides/<id>` hash: opening one adds a history entry, so Back (or a
// phone's back gesture) closes it, and the same address opens it straight away.
const GuidesCheatsSection = ({ gameId, libraryItems, gamePlatforms }: GuidesCheatsSectionProps) => {
  const { t } = useTranslation();
  const { data: guides, isError } = useGuides(gameId);
  const deleteGuide = useDeleteGuide(gameId);
  const [dialog, setDialog] = useState<{ guide?: Guide; replace?: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Guide | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Whether this page opened the reader (so closing it goes Back) or the address did.
  const pushedReader = useRef(false);

  const readerMatch = READER_HASH.exec(location.hash);
  const readerId = readerMatch ? Number(readerMatch[1]) : null;
  const readerGuide =
    readerId !== null
      ? guides?.find((guide) => guide.id === readerId && guide.source === "file")
      : undefined;

  const openReader = (guide: Guide) => {
    pushedReader.current = true;
    navigate(
      { pathname: location.pathname, search: location.search, hash: `guides/${guide.id}` },
      { state: location.state }
    );
  };

  const closeReader = () => {
    if (pushedReader.current) {
      pushedReader.current = false;
      navigate(-1);
    } else {
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true, state: location.state }
      );
    }
  };

  // An address naming a guide that isn't here (deleted, or a link): drop it.
  useEffect(() => {
    if (readerId !== null && guides && !readerGuide) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true, state: location.state }
      );
    }
  }, [readerId, guides, readerGuide, navigate, location.pathname, location.search, location.state]);

  const openRow = (guide: Guide) => {
    if (guide.source === "link") {
      if (guide.url) window.open(guide.url, "_blank", "noopener,noreferrer");
    } else if (guide.fileMissing) {
      setDialog({ guide, replace: true });
    } else {
      openReader(guide);
    }
  };

  const handleDownload = async (guide: Guide) => {
    setDownloadingId(guide.id);
    try {
      const url = await createGuideDownloadLink(guide.id);
      downloadFromUrl(resolveAssetUrl(url) ?? url);
    } catch (error) {
      console.error("Error downloading guide:", error);
      toast.error(serverDetail(error) ?? t("guides.errors.downloadError"), TOAST_OPTIONS);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    try {
      await deleteGuide.mutateAsync(pendingDelete.id);
      forgetGuidePosition(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      console.error("Error deleting guide:", error);
      toast.error(t("guides.errors.deleteError"), TOAST_OPTIONS);
    }
  };

  const hasGuides = Boolean(guides && guides.length);

  return (
    <Section
      id="guides"
      title={t("guides.title")}
      action={
        <SectionAction
          icon={<AddIcon />}
          label={t("guides.addAction")}
          onClick={() => setDialog({})}
        />
      }
    >
      {isError ? (
        <EmptyLine>{t("guides.errors.loadError")}</EmptyLine>
      ) : !hasGuides ? (
        <EmptyLine>{t("guides.empty")}</EmptyLine>
      ) : (
        <Panel>
          {(guides ?? []).map((guide) => (
            <ListRow
              key={guide.id}
              leading={<KindTile guide={guide} />}
              title={guide.name}
              subtitle={<GuideSubtitle guide={guide} />}
              label={
                guide.source === "link"
                  ? t("guides.openLink", { name: guide.name })
                  : t("guides.open", { name: guide.name })
              }
              onClick={() => openRow(guide)}
              actions={
                <>
                  {guide.source === "link" ? (
                    <RowAction
                      title={t("guides.openInNewTab")}
                      icon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => openRow(guide)}
                    />
                  ) : !guide.fileMissing ? (
                    <RowAction
                      title={t("guides.download")}
                      icon={
                        downloadingId === guide.id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <FileDownloadOutlinedIcon fontSize="small" />
                        )
                      }
                      onClick={() => void handleDownload(guide)}
                    />
                  ) : null}
                  <RowAction
                    title={t("common.edit")}
                    icon={<EditOutlinedIcon fontSize="small" />}
                    onClick={() => setDialog({ guide })}
                  />
                  <RowAction
                    title={t("common.delete")}
                    icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                    onClick={() => setPendingDelete(guide)}
                  />
                </>
              }
            />
          ))}
        </Panel>
      )}

      {readerGuide ? (
        <Suspense
          fallback={
            <Dialog open fullScreen onClose={closeReader}>
              <Box
                sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <CircularProgress aria-label={t("guides.reader.loading")} />
              </Box>
            </Dialog>
          }
        >
          <GuideReader
            guide={readerGuide}
            onClose={closeReader}
            onReplace={(guide) => {
              closeReader();
              setDialog({ guide, replace: true });
            }}
          />
        </Suspense>
      ) : null}

      {dialog ? (
        <GuideDialog
          open
          gameId={gameId}
          guide={dialog.guide}
          highlightReplace={dialog.replace}
          libraryItems={libraryItems}
          gamePlatforms={gamePlatforms}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("guides.deleteTitle", { name: pendingDelete?.name ?? "" })}
        description={
          pendingDelete?.source === "link" ? t("guides.deleteLinkNote") : t("guides.deleteFileNote")
        }
        confirmLabel={t("common.delete")}
        confirmColor="error"
        busy={deleteGuide.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </Section>
  );
};

export default GuidesCheatsSection;
