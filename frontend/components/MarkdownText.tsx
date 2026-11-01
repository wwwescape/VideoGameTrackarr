import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

// The small part of GitHub Markdown our release notes use (see the release-notes format):
// headings, "-" lists (nested by indent), paragraphs, rules, and inline **bold**, `code`,
// [links](https://…), bare https addresses and #123 issue references. Built as React
// elements, never as HTML, so nothing in the text can inject markup; links must be http(s).

interface MarkdownTextProps {
  text: string;
  // Where "#123" points: <repoUrl>/issues/123.
  repoUrl?: string;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "rule" }
  | { kind: "list"; items: ListItem[] };

interface ListItem {
  text: string;
  children: ListItem[];
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(!?\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)|(#\d+\b)/g;

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function renderInline(text: string, repoUrl: string | undefined): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const [token] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const key = `${index}`;
    if (match[1]) {
      nodes.push(
        <Box key={key} component="code" sx={{ fontFamily: "monospace", fontSize: "0.9em", px: 0.5, borderRadius: 0.5, bgcolor: "action.hover" }}>
          {token.slice(1, -1)}
        </Box>
      );
    } else if (match[2]) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), repoUrl)}</strong>);
    } else if (match[3]) {
      const [, label, url] = /^!?\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];
      nodes.push(
        url && isSafeUrl(url) ? (
          <Link key={key} href={url} target="_blank" rel="noopener noreferrer">
            {label}
          </Link>
        ) : (
          label
        )
      );
    } else if (match[4]) {
      nodes.push(
        <Link key={key} href={token} target="_blank" rel="noopener noreferrer" sx={{ wordBreak: "break-all" }}>
          {token}
        </Link>
      );
    } else if (match[5]) {
      nodes.push(
        repoUrl ? (
          <Link key={key} href={`${repoUrl}/issues/${token.slice(1)}`} target="_blank" rel="noopener noreferrer">
            {token}
          </Link>
        ) : (
          token
        )
      );
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  // The open list, and its items at each indent level.
  let list: { kind: "list"; items: ListItem[] } | null = null;
  let stack: { indent: number; items: ListItem[] }[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const closeList = () => {
    list = null;
    stack = [];
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeList();
      blocks.push({ kind: "rule" });
    } else if (item) {
      flushParagraph();
      const indent = item[1].replace(/\t/g, "  ").length;
      const entry: ListItem = { text: item[2], children: [] };
      if (!list) {
        list = { kind: "list", items: [] };
        blocks.push(list);
        stack = [{ indent, items: list.items }];
      }
      while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
      const top = stack[stack.length - 1];
      if (indent > top.indent && top.items.length) {
        const parent = top.items[top.items.length - 1];
        stack.push({ indent, items: parent.children });
      }
      stack[stack.length - 1].items.push(entry);
    } else if (list && /^\s+/.test(line) && stack.length) {
      // A wrapped list line continues the last item.
      const items = stack[stack.length - 1].items;
      items[items.length - 1].text += ` ${line.trim()}`;
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  return blocks;
}

const ItemList = ({ items, repoUrl }: { items: ListItem[]; repoUrl?: string }) => (
  <Box component="ul" sx={{ m: 0, mb: 1, pl: 2.5, "& li": { mb: 0.5 } }}>
    {items.map((item, index) => (
      <li key={index}>
        {renderInline(item.text, repoUrl)}
        {item.children.length ? <ItemList items={item.children} repoUrl={repoUrl} /> : null}
      </li>
    ))}
  </Box>
);

const MarkdownText = ({ text, repoUrl }: MarkdownTextProps) => (
  <Box sx={{ fontSize: 14, lineHeight: 1.55, color: "text.secondary", wordBreak: "break-word" }}>
    {parseMarkdown(text).map((block, index) => (
      <Fragment key={index}>
        {block.kind === "heading" ? (
          <Typography
            component={block.level <= 2 ? "h3" : "h4"}
            sx={{ fontSize: block.level <= 2 ? 15.5 : 14.5, fontWeight: 650, color: "text.primary", mt: index ? 2 : 0, mb: 0.75 }}
          >
            {renderInline(block.text, repoUrl)}
          </Typography>
        ) : block.kind === "paragraph" ? (
          <Typography component="p" sx={{ fontSize: "inherit", lineHeight: "inherit", mb: 1 }}>
            {renderInline(block.text, repoUrl)}
          </Typography>
        ) : block.kind === "rule" ? (
          <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: "divider", my: 1.5 }} />
        ) : (
          <ItemList items={block.items} repoUrl={repoUrl} />
        )}
      </Fragment>
    ))}
  </Box>
);

export default MarkdownText;
