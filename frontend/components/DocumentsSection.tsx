import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { createDocumentDownloadLink, type DocumentOwner } from "../api/documents";
import type { DocumentEntry, LibraryItem, PlatformResponse } from "../api/types";
import { useCreateDocumentLink, useDeleteDocument, useDocuments } from "../hooks/useDocuments";
import { downloadFromUrl } from "../utils/download";
import { formatFileSize } from "../utils/fileSize";
import { serverDetail } from "../utils/guideLinks";
import { forgetGuidePosition } from "../utils/guideReaderPosition";
import { documentHashPrefix, documentPositionKey, entryCopyLabel } from "../utils/guides";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { EmptyLine, ListRow, Panel, RowAction, Section, SectionAction } from "./Detail";
import DocumentDialog, { type CopyOption } from "./DocumentDialog";
import { DocumentKindTile } from "./documentKinds";

// The reader (and pdf.js inside it) is only fetched when a document is first opened.
const GuideReader = lazy(() => import("./guideReader/GuideReader"));

export interface DocumentsSectionProps {
  owner: DocumentOwner;
  // The section's anchor id and the reader's address hash ("guides" on a game).
  sectionId: string;
  title: string;
  emptyText: string;
  // Your copies of the owner, for the Copy picker and the rows' subtitles.
  copies: CopyOption[];
  // Games only: the Platform picker.
  libraryItems?: LibraryItem[];
  gamePlatforms?: PlatformResponse[];
  // The manufacturer's own manual (curated reference data), offered as a one-click link
  // until you've added it.
  officialManualUrl?: string | null;
}

// A row's detail line: format · size · platform · copy for a file, the site for a link, "File
// missing" for a file that isn't on the server.
const DocumentSubtitle = ({ entry }: { entry: DocumentEntry }) => {
  const { t } = useTranslation();
  const extra = [entry.platformName, entryCopyLabel(t, entry)].filter(Boolean).join(" · ");
  if (entry.source === "link") {
    return (
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}
      >
        <LinkOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />
        {[entry.domain, extra].filter(Boolean).join(" · ")}
      </Box>
    );
  }
  if (entry.fileMissing) {
    return (
      <>
        <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>
          {t("guides.fileMissing")}
        </Box>
        {extra ? ` · ${extra}` : null}
      </>
    );
  }
  const parts = [
    entry.mediaFormat ? t(`guides.format.${entry.mediaFormat}`) : null,
    entry.sizeBytes != null ? formatFileSize(entry.sizeBytes) : null,
    extra,
  ];
  return <>{parts.filter(Boolean).join(" · ")}</>;
};

// An owner's documents (a game's Guides & Cheats; a device's, accessory's or pack's Manuals &
// Documents): uploaded files (PDF, Word, Markdown, text, images) and saved links, as rows like
// the library's. A file opens in the in-app reader, a link opens its page in a new tab; each can
// be downloaded or opened, edited and deleted. The reader's open entry is the page's
// `#<sectionId>/<id>` hash: opening one adds a history entry, so Back (or a phone's back
// gesture) closes it, and the same address opens it straight away.
const DocumentsSection = ({
  owner: ownerProp,
  sectionId,
  title,
  emptyText,
  copies,
  libraryItems,
  gamePlatforms,
  officialManualUrl,
}: DocumentsSectionProps) => {
  const { t } = useTranslation();
  // Pages pass a fresh object each render; the reader re-asks for its link when this changes.
  const owner = useMemo(
    () => ({ type: ownerProp.type, id: ownerProp.id }),
    [ownerProp.type, ownerProp.id]
  );
  const { data: entries, isError } = useDocuments(owner);
  const deleteEntry = useDeleteDocument(owner);
  const createLink = useCreateDocumentLink(owner);
  const [dialog, setDialog] = useState<{ entry?: DocumentEntry; replace?: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentEntry | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Whether this page opened the reader (so closing it goes Back) or the address did.
  const pushedReader = useRef(false);

  const hashPrefix = documentHashPrefix(owner);
  const readerMatch = new RegExp(`^#${hashPrefix}/(\\d+)$`).exec(location.hash);
  const readerId = readerMatch ? Number(readerMatch[1]) : null;
  const readerEntry =
    readerId !== null
      ? entries?.find((entry) => entry.id === readerId && entry.source === "file")
      : undefined;

  const openReader = (entry: DocumentEntry) => {
    pushedReader.current = true;
    navigate(
      { pathname: location.pathname, search: location.search, hash: `${hashPrefix}/${entry.id}` },
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

  // An address naming an entry that isn't here (deleted, or a link): drop it.
  useEffect(() => {
    if (readerId !== null && entries && !readerEntry) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true, state: location.state }
      );
    }
  }, [
    readerId,
    entries,
    readerEntry,
    navigate,
    location.pathname,
    location.search,
    location.state,
  ]);

  const openRow = (entry: DocumentEntry) => {
    if (entry.source === "link") {
      if (entry.url) window.open(entry.url, "_blank", "noopener,noreferrer");
    } else if (entry.fileMissing) {
      setDialog({ entry, replace: true });
    } else {
      openReader(entry);
    }
  };

  const handleDownload = async (entry: DocumentEntry) => {
    setDownloadingId(entry.id);
    try {
      const url = await createDocumentDownloadLink(owner, entry.id);
      downloadFromUrl(resolveAssetUrl(url) ?? url);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error(serverDetail(error) ?? t("guides.errors.downloadError"), TOAST_OPTIONS);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    try {
      await deleteEntry.mutateAsync(pendingDelete.id);
      forgetGuidePosition(documentPositionKey(owner, pendingDelete.id));
      setPendingDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(t("guides.errors.deleteError"), TOAST_OPTIONS);
    }
  };

  const addOfficialManual = async () => {
    if (!officialManualUrl) return;
    try {
      await createLink.mutateAsync({
        url: officialManualUrl,
        fields: { kind: "manual", name: t("documents.officialManualName") },
      });
      toast.success(t("guides.added"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error adding the official manual:", error);
      toast.error(serverDetail(error) ?? t("guides.errors.saveError"), TOAST_OPTIONS);
    }
  };

  const hasEntries = Boolean(entries && entries.length);
  const offerOfficialManual =
    Boolean(officialManualUrl) &&
    entries !== undefined &&
    !entries.some((entry) => entry.url === officialManualUrl);

  return (
    <Section
      id={sectionId}
      title={title}
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
      ) : !hasEntries ? (
        <EmptyLine>{emptyText}</EmptyLine>
      ) : (
        <Panel>
          {(entries ?? []).map((entry) => (
            <ListRow
              key={entry.id}
              leading={<DocumentKindTile kind={entry.kind} />}
              title={entry.name}
              subtitle={<DocumentSubtitle entry={entry} />}
              label={
                entry.source === "link"
                  ? t("guides.openLink", { name: entry.name })
                  : t("guides.open", { name: entry.name })
              }
              onClick={() => openRow(entry)}
              actions={
                <>
                  {entry.source === "link" ? (
                    <RowAction
                      title={t("guides.openInNewTab")}
                      icon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => openRow(entry)}
                    />
                  ) : !entry.fileMissing ? (
                    <RowAction
                      title={t("guides.download")}
                      icon={
                        downloadingId === entry.id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <FileDownloadOutlinedIcon fontSize="small" />
                        )
                      }
                      onClick={() => void handleDownload(entry)}
                    />
                  ) : null}
                  <RowAction
                    title={t("common.edit")}
                    icon={<EditOutlinedIcon fontSize="small" />}
                    onClick={() => setDialog({ entry })}
                  />
                  <RowAction
                    title={t("common.delete")}
                    icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                    onClick={() => setPendingDelete(entry)}
                  />
                </>
              }
            />
          ))}
        </Panel>
      )}

      {offerOfficialManual ? (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            startIcon={
              createLink.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <MenuBookOutlinedIcon fontSize="small" />
              )
            }
            disabled={createLink.isPending}
            onClick={() => void addOfficialManual()}
          >
            {t("documents.addOfficialManual")}
          </Button>
        </Box>
      ) : null}

      {readerEntry ? (
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
            owner={owner}
            guide={readerEntry}
            onClose={closeReader}
            onReplace={(entry) => {
              closeReader();
              setDialog({ entry, replace: true });
            }}
          />
        </Suspense>
      ) : null}

      {dialog ? (
        <DocumentDialog
          open
          owner={owner}
          entry={dialog.entry}
          highlightReplace={dialog.replace}
          copies={copies}
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
        busy={deleteEntry.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </Section>
  );
};

export default DocumentsSection;
