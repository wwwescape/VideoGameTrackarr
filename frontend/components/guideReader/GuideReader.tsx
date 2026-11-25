import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../../api/client";
import {
  createDocumentDownloadLink,
  createDocumentViewLink,
  type DocumentOwner,
} from "../../api/documents";
import type { DocumentEntry } from "../../api/types";
import { downloadFromUrl } from "../../utils/download";
import { openGuideInNewTab, serverDetail } from "../../utils/guideLinks";
import { documentPositionKey } from "../../utils/guides";
import { TOAST_OPTIONS } from "../../utils/toastOptions";
import { DOCUMENT_KIND_COLORS, DOCUMENT_KIND_ICONS } from "../documentKinds";
import HtmlView from "./HtmlView";
import ImageView from "./ImageView";
import TextView from "./TextView";
import type { FindRequest, FindResult, GuideViewProps } from "./types";

// pdf.js is big: only fetched when a PDF is opened.
const PdfView = lazy(() => import("./PdfView"));

interface GuideReaderProps {
  // Whose document it is: decides which signed links are asked for.
  owner: DocumentOwner;
  guide: DocumentEntry;
  onClose: () => void;
  // The file isn't on the server: open Edit, pointed at Replace.
  onReplace: (guide: DocumentEntry) => void;
}

const IMAGE_FORMATS = new Set(["jpg", "png", "webp"]);

const NO_RESULT: FindResult = { current: 0, total: 0, capped: false };

const Centered = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      p: 3,
      textAlign: "center",
    }}
  >
    {children}
  </Box>
);

// The document reader (Guides & Cheats, Manuals & Documents): a full-screen dialog that shows a
// file inside the app — PDFs in pdf.js, Word/Markdown as a readable page, text in monospace,
// images fitted with zoom — with find on page (Ctrl/Cmd+F, not for images), and the place you
// left each document remembered. A fresh signed view link is asked for every time it opens.
const GuideReader = ({ owner, guide, onClose, onReplace }: GuideReaderProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<FindRequest["step"]>({ seq: 0, previous: false });
  const [result, setResult] = useState<FindResult>(NO_RESULT);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (guide.fileMissing) return undefined;
    let cancelled = false;
    setStatus("loading");
    setUrl(null);
    createDocumentViewLink(owner, guide.id)
      .then((link) => {
        if (cancelled) return;
        setUrl(resolveAssetUrl(link) ?? link);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Error opening guide:", error);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [owner, guide.id, guide.fileMissing, attempt]);

  const handleViewError = useCallback((error: unknown) => {
    console.error("Error showing guide:", error);
    setStatus("error");
  }, []);

  const handleFindResult = useCallback((next: FindResult) => setResult(next), []);

  const openFind = () => {
    setFindOpen(true);
    window.setTimeout(() => findInputRef.current?.select(), 0);
  };

  const closeFind = () => {
    setFindOpen(false);
    setQuery("");
    setResult(NO_RESULT);
    // The find field is going away: keep focus in the reader, so Esc can still close it.
    window.setTimeout(() => findButtonRef.current?.focus(), 0);
  };

  const move = (previous: boolean) => setStep((current) => ({ seq: current.seq + 1, previous }));

  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openFind();
    }
  };

  const handleDownload = async () => {
    setMenuAnchor(null);
    setDownloading(true);
    try {
      const link = await createDocumentDownloadLink(owner, guide.id);
      downloadFromUrl(resolveAssetUrl(link) ?? link);
    } catch (error) {
      console.error("Error downloading guide:", error);
      toast.error(serverDetail(error) ?? t("guides.errors.downloadError"), TOAST_OPTIONS);
    } finally {
      setDownloading(false);
    }
  };

  const handleNewTab = () => {
    setMenuAnchor(null);
    void openGuideInNewTab(owner, guide, (error) => {
      console.error("Error opening guide:", error);
      toast.error(serverDetail(error) ?? t("guides.errors.openError"), TOAST_OPTIONS);
    });
  };

  const find: FindRequest = { query: findOpen ? query : "", step };
  const viewProps: Omit<GuideViewProps, "url"> = {
    guide,
    positionKey: documentPositionKey(owner, guide.id),
    find,
    onFindResult: handleFindResult,
    onError: handleViewError,
  };
  const KindIcon = DOCUMENT_KIND_ICONS[guide.kind];
  const isImage = guide.mediaFormat !== null && IMAGE_FORMATS.has(guide.mediaFormat);
  const canFind = !guide.fileMissing && status === "ready" && !isImage;

  const matchLabel =
    query.trim().length < 2
      ? ""
      : result.total === 0
        ? t("guides.reader.noMatches")
        : t(result.capped ? "guides.reader.matchCountMany" : "guides.reader.matchCount", {
            current: result.current,
            total: result.total,
          });

  let body: ReactNode;
  if (guide.fileMissing) {
    body = (
      <Centered>
        <Typography>{t("guides.reader.fileMissing")}</Typography>
        <Button variant="contained" onClick={() => onReplace(guide)}>
          {t("guides.reader.replace")}
        </Button>
      </Centered>
    );
  } else if (status === "error") {
    body = (
      <Centered>
        <Typography>{t("guides.reader.openError")}</Typography>
        <Button variant="outlined" onClick={() => setAttempt((n) => n + 1)}>
          {t("guides.reader.tryAgain")}
        </Button>
      </Centered>
    );
  } else if (status === "loading" || !url) {
    body = (
      <Centered>
        <CircularProgress aria-label={t("guides.reader.loading")} />
      </Centered>
    );
  } else if (guide.mediaFormat === "pdf") {
    body = (
      <Suspense
        fallback={
          <Centered>
            <CircularProgress aria-label={t("guides.reader.loading")} />
          </Centered>
        }
      >
        <PdfView key={url} url={url} {...viewProps} />
      </Suspense>
    );
  } else if (isImage) {
    body = <ImageView key={url} url={url} {...viewProps} />;
  } else if (guide.mediaFormat === "txt") {
    body = <TextView key={url} url={url} {...viewProps} />;
  } else {
    body = <HtmlView key={url} url={url} {...viewProps} />;
  }

  return (
    <Dialog
      open
      fullScreen
      onClose={(_event, reason) => {
        // Esc closes the find bar first, then the reader.
        if (reason === "escapeKeyDown" && findOpen) {
          closeFind();
          return;
        }
        onClose();
      }}
      onKeyDown={handleKeyDown}
      aria-labelledby="guide-reader-title"
      slotProps={{
        paper: { sx: { display: "flex", flexDirection: "column", bgcolor: "background.default" } },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 1, sm: 2 },
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <KindIcon sx={{ color: DOCUMENT_KIND_COLORS[guide.kind] }} aria-hidden />
        <Tooltip title={guide.name}>
          <Typography
            id="guide-reader-title"
            variant="subtitle1"
            component="h2"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {guide.name}
          </Typography>
        </Tooltip>
        <Tooltip title={t("guides.reader.find")}>
          <span>
            <IconButton
              ref={findButtonRef}
              aria-label={t("guides.reader.find")}
              disabled={!canFind}
              onClick={openFind}
            >
              <SearchIcon />
            </IconButton>
          </span>
        </Tooltip>
        {phone ? (
          <>
            <IconButton
              aria-label={t("guides.reader.moreActions")}
              aria-haspopup="menu"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem onClick={handleNewTab} disabled={guide.fileMissing}>
                <ListItemIcon>
                  <OpenInNewIcon fontSize="small" />
                </ListItemIcon>
                {t("guides.openInNewTab")}
              </MenuItem>
              <MenuItem onClick={() => void handleDownload()} disabled={guide.fileMissing}>
                <ListItemIcon>
                  <FileDownloadOutlinedIcon fontSize="small" />
                </ListItemIcon>
                {t("guides.download")}
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <Tooltip title={t("guides.openInNewTab")}>
              <span>
                <IconButton
                  aria-label={t("guides.openInNewTab")}
                  disabled={guide.fileMissing}
                  onClick={handleNewTab}
                >
                  <OpenInNewIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("guides.download")}>
              <span>
                <IconButton
                  aria-label={t("guides.download")}
                  disabled={guide.fileMissing || downloading}
                  onClick={() => void handleDownload()}
                >
                  {downloading ? <CircularProgress size={20} /> : <FileDownloadOutlinedIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
        <Tooltip title={t("guides.reader.close")}>
          <IconButton aria-label={t("guides.reader.close")} onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {findOpen ? (
        <Box
          role="search"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: { xs: 1, sm: 2 },
            py: 0.5,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            flexShrink: 0,
          }}
        >
          <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} aria-hidden />
          <InputBase
            inputRef={findInputRef}
            autoFocus
            value={query}
            placeholder={t("guides.reader.findPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                move(event.shiftKey);
              }
            }}
            inputProps={{ "aria-label": t("guides.reader.find") }}
            sx={{ flex: 1, minWidth: 0, fontSize: 15 }}
          />
          <Typography
            variant="body2"
            aria-live="polite"
            sx={{ color: "text.secondary", whiteSpace: "nowrap", mx: 1 }}
          >
            {matchLabel}
          </Typography>
          <Tooltip title={t("guides.reader.previousMatch")}>
            <span>
              <IconButton
                size="small"
                aria-label={t("guides.reader.previousMatch")}
                disabled={result.total === 0}
                onClick={() => move(true)}
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("guides.reader.nextMatch")}>
            <span>
              <IconButton
                size="small"
                aria-label={t("guides.reader.nextMatch")}
                disabled={result.total === 0}
                onClick={() => move(false)}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("guides.reader.closeFind")}>
            <IconButton size="small" aria-label={t("guides.reader.closeFind")} onClick={closeFind}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{body}</Box>
    </Dialog>
  );
};

export default GuideReader;
