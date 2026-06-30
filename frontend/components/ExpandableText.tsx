import { useLayoutEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface ExpandableTextProps {
  text: string;
  collapsedLines?: number;
}

// Clamps long text (Summary/Storyline can run to several paragraphs) to a few lines with
// a "Read more"/"Read less" toggle. Whether the toggle even shows is decided by measuring
// the clamped element's scrollHeight vs clientHeight once on mount, rather than guessing a
// character-count threshold — font size and column width vary too much for that to be
// reliable across screen sizes.
const ExpandableText = ({ text, collapsedLines = 4 }: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <>
      <Typography
        ref={textRef}
        variant="body1"
        component="div"
        sx={{
          lineHeight: 1.7,
          // IGDB summaries are usually one dense paragraph, but hand-typed/pasted text (custom
          // games, marketing copy with bullet points) relies on its own line breaks for
          // structure — plain HTML collapses those by default, which is exactly what was
          // flattening multi-paragraph Summary/Storyline text into one run-on block.
          whiteSpace: "pre-line",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: collapsedLines,
                overflow: "hidden",
              }),
        }}
      >
        {text}
      </Typography>
      {isClamped ? (
        <Button size="small" onClick={() => setExpanded((prev) => !prev)} sx={{ mt: 0.5, px: 0, minWidth: 0 }}>
          {expanded ? "Read less" : "Read more"}
        </Button>
      ) : null}
    </>
  );
};

export default ExpandableText;
