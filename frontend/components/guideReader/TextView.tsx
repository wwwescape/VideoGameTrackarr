import { useEffect, useRef, useState } from "react";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import WrapTextIcon from "@mui/icons-material/WrapText";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { useLocalPreference } from "../../hooks/useLocalPreference";
import { useTextFind } from "../../hooks/useTextFind";
import { FIND_MARK_SX, useFindBridge } from "./findMarks";
import type { GuideViewProps } from "./types";
import { useSavedScroll } from "./useSavedScroll";
import ViewToolbar from "./ViewToolbar";

const MIN_SIZE = 12;
const MAX_SIZE = 20;
// Wide screens usually fit a text guide's ASCII art; narrow ones need it wrapped.
// Worked out when the reader opens (not when this module first loads), until you choose.
const wrapsByDefault = () => window.innerWidth < 900;

// A .txt guide (the classic GameFAQs format): monospace, spacing kept, wrap on or off, text
// size. The text goes into the <pre> directly (not through React), because find on page
// splits its text into <mark>s.
const TextView = ({ guide, positionKey, url, find, onFindResult, onError }: GuideViewProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [wrap, setWrap] = useLocalPreference("guides.wrap", wrapsByDefault());
  const [size, setSize] = useLocalPreference("guides.textSize", 14);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (preRef.current) preRef.current.textContent = text;
        setLoadedUrl(url);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) onError(error);
      });
    return () => controller.abort();
  }, [url, onError]);

  const ready = loadedUrl === url;
  useSavedScroll(scrollRef, positionKey, guide.updatedAt, ready);
  const textFind = useTextFind(preRef, ready ? find.query : "", loadedUrl);
  useFindBridge(textFind, find, onFindResult);

  return (
    <>
      <ViewToolbar>
        <Tooltip title={t("guides.reader.wrapLines")}>
          <ToggleButton
            value="wrap"
            size="small"
            selected={wrap}
            onChange={() => setWrap(!wrap)}
            aria-label={t("guides.reader.wrapLines")}
            sx={{ border: 0 }}
          >
            <WrapTextIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title={t("guides.reader.textSmaller")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.textSmaller")}
              disabled={size <= MIN_SIZE}
              onClick={() => setSize(Math.max(MIN_SIZE, size - 1))}
            >
              <TextDecreaseIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("guides.reader.textLarger")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("guides.reader.textLarger")}
              disabled={size >= MAX_SIZE}
              onClick={() => setSize(Math.min(MAX_SIZE, size + 1))}
            >
              <TextIncreaseIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ViewToolbar>
      <Box ref={scrollRef} sx={{ flex: 1, overflow: "auto", bgcolor: "background.default" }}>
        <Box
          component="pre"
          ref={preRef}
          data-testid="guide-text"
          sx={{
            m: 0,
            p: { xs: 2, md: 3 },
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
            fontSize: size,
            lineHeight: 1.45,
            color: "text.primary",
            whiteSpace: wrap ? "pre-wrap" : "pre",
            overflowWrap: wrap ? "anywhere" : "normal",
            width: wrap ? "auto" : "max-content",
            minWidth: "100%",
            ...FIND_MARK_SX,
          }}
        />
      </Box>
    </>
  );
};

export default TextView;
