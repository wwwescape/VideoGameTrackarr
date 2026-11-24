import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import ExpandIcon from "@mui/icons-material/Expand";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { loadGuidePosition, saveGuidePosition } from "../../utils/guideReaderPosition";
import { loadPdfjs, PDFJS_DATA, type Pdfjs } from "./pdfjs";
import type { GuideViewProps } from "./types";
import ViewToolbar from "./ViewToolbar";

type Viewer = InstanceType<Pdfjs["viewer"]["PDFViewer"]>;
type EventBus = InstanceType<Pdfjs["viewer"]["EventBus"]>;

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.1;
const SAVE_EVERY_MS = 1000;

// A PDF guide in pdf.js's own viewer: continuous scroll, the text layer (select and find),
// in-document links (a table of contents jumps within the file; other links open a new tab),
// a page box, zoom and fit. The whole file is fetched in one request, so the hour-long view
// link expiring never interrupts a long read. Pages stay white in dark mode.
const PdfView = ({ guide, url, find, onFindResult, onError }: GuideViewProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pdfViewer = useRef<Viewer | null>(null);
  const eventBus = useRef<EventBus | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    (async () => {
      const { lib, viewer } = await loadPdfjs();
      if (cancelled || !containerRef.current || !viewerRef.current) return;
      const bus = new viewer.EventBus();
      const linkService = new viewer.PDFLinkService({
        eventBus: bus,
        externalLinkTarget: viewer.LinkTarget.BLANK,
        externalLinkRel: "noopener noreferrer nofollow",
      });
      const findController = new viewer.PDFFindController({ eventBus: bus, linkService });
      const instance = new viewer.PDFViewer({
        container: containerRef.current,
        viewer: viewerRef.current,
        eventBus: bus,
        linkService,
        findController,
      });
      linkService.setViewer(instance);
      pdfViewer.current = instance;
      eventBus.current = bus;

      const task = lib.getDocument({ url, disableRange: true, disableStream: true, ...PDFJS_DATA });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (!cancelled && total) setProgress(loaded / total);
      };

      let saveTimer: number | null = null;
      const save = () => {
        if (!instance.pdfDocument) return;
        saveGuidePosition(guide.id, guide.updatedAt, {
          kind: "pdf",
          page: instance.currentPageNumber,
          scale: instance.currentScaleValue || String(instance.currentScale),
        });
      };
      const saveSoon = () => {
        if (saveTimer !== null) return;
        saveTimer = window.setTimeout(() => {
          saveTimer = null;
          save();
        }, SAVE_EVERY_MS);
      };

      bus.on("pagesinit", () => {
        const saved = loadGuidePosition(guide.id, guide.updatedAt);
        instance.currentScaleValue = saved?.kind === "pdf" ? saved.scale : "page-width";
        if (saved?.kind === "pdf" && saved.page <= instance.pagesCount)
          instance.currentPageNumber = saved.page;
        setScale(instance.currentScale);
      });
      bus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => {
        setPage(pageNumber);
        setPageInput(String(pageNumber));
        saveSoon();
      });
      bus.on("scalechanging", ({ scale: next }: { scale: number }) => {
        setScale(next);
        saveSoon();
      });
      const reportMatches = ({
        matchesCount,
      }: {
        matchesCount: { current: number; total: number };
      }) =>
        onFindResult({ current: matchesCount.current, total: matchesCount.total, capped: false });
      bus.on("updatefindmatchescount", reportMatches);
      bus.on("updatefindcontrolstate", reportMatches);

      destroy = () => {
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        save();
        void task.destroy();
        instance.setDocument(null as never);
        linkService.setDocument(null as never, null);
      };

      try {
        const document = await task.promise;
        if (cancelled) return;
        instance.setDocument(document);
        linkService.setDocument(document, null);
        setPageCount(document.numPages);
        setProgress(null);
      } catch (error) {
        if (!cancelled) onError(error);
      }
    })().catch((error: unknown) => {
      if (!cancelled) onError(error);
    });
    return () => {
      cancelled = true;
      destroy?.();
      pdfViewer.current = null;
      eventBus.current = null;
    };
    // Reopened only for a different link or guide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, guide.id, guide.updatedAt]);

  // Find on page, through pdf.js's own find controller.
  const lastQuery = useRef("");
  const lastStep = useRef(0);
  useEffect(() => {
    const bus = eventBus.current;
    if (!bus) return;
    const query = find.query.trim();
    if (!query) {
      if (lastQuery.current) bus.dispatch("findbarclose", { source: null });
      lastQuery.current = "";
      onFindResult({ current: 0, total: 0, capped: false });
      return;
    }
    // Next/Previous on the same text moves along; anything else (new text, the document
    // loading) searches afresh from the current page.
    const again = query === lastQuery.current && find.step.seq !== lastStep.current;
    lastQuery.current = query;
    lastStep.current = find.step.seq;
    bus.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: again && find.step.previous,
      matchDiacritics: false,
    });
  }, [find.query, find.step, onFindResult, pageCount]);

  const zoom = (factor: number) => {
    const instance = pdfViewer.current;
    if (!instance) return;
    instance.currentScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, instance.currentScale * factor)
    );
  };

  const fit = (value: "page-width" | "page-fit") => {
    if (pdfViewer.current) pdfViewer.current.currentScaleValue = value;
  };

  const goToPage = () => {
    const instance = pdfViewer.current;
    const wanted = Number.parseInt(pageInput, 10);
    if (instance && Number.isFinite(wanted) && wanted >= 1 && wanted <= instance.pagesCount) {
      instance.currentPageNumber = wanted;
    } else {
      setPageInput(String(page));
    }
  };

  const onPageKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") goToPage();
  };

  return (
    <>
      <ViewToolbar>
        <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
          {t("guides.reader.page")}
        </Typography>
        <InputBase
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
          onKeyDown={onPageKey}
          onBlur={goToPage}
          disabled={!pageCount}
          inputProps={{ inputMode: "numeric", "aria-label": t("guides.reader.page"), size: 4 }}
          sx={{
            width: 56,
            px: 1,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            fontSize: 14,
            "& input": { textAlign: "center", p: "2px 0" },
          }}
        />
        <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap", mr: 1 }}>
          {pageCount ? t("guides.reader.pageOf", { total: pageCount }) : ""}
        </Typography>
        <Tooltip title={t("guides.reader.zoomOut")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.zoomOut")}
              disabled={!pageCount || scale <= MIN_SCALE}
              onClick={() => zoom(1 / ZOOM_STEP)}
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          variant="body2"
          sx={{ minWidth: 44, textAlign: "center", color: "text.secondary" }}
        >
          {pageCount ? `${Math.round(scale * 100)}%` : ""}
        </Typography>
        <Tooltip title={t("guides.reader.zoomIn")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.zoomIn")}
              disabled={!pageCount || scale >= MAX_SCALE}
              onClick={() => zoom(ZOOM_STEP)}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("guides.reader.fitWidth")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.fitWidth")}
              disabled={!pageCount}
              onClick={() => fit("page-width")}
            >
              <ExpandIcon fontSize="small" sx={{ transform: "rotate(90deg)" }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("guides.reader.fitPage")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.fitPage")}
              disabled={!pageCount}
              onClick={() => fit("page-fit")}
            >
              <FitScreenOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ViewToolbar>
      {progress !== null ? (
        <LinearProgress
          variant={progress > 0 ? "determinate" : "indeterminate"}
          value={Math.round(progress * 100)}
          aria-label={t("guides.reader.loading")}
        />
      ) : null}
      {/* pdf.js needs its scrolling container absolutely positioned. */}
      <Box
        sx={{
          position: "relative",
          flex: 1,
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.300"),
        }}
      >
        <Box
          ref={containerRef}
          data-testid="guide-pdf"
          tabIndex={0}
          sx={{ position: "absolute", inset: 0, overflow: "auto", outline: "none" }}
        >
          <div ref={viewerRef} className="pdfViewer" />
        </Box>
      </Box>
    </>
  );
};

export default PdfView;
