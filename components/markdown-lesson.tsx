import { Fragment, type ReactNode } from "react";

// Minimal markdown renderer for lesson bodies. Handles:
// - #, ##, ###, #### headings
// - > blockquotes
// - - / * unordered lists
// - **bold** and *italic* inline
// No raw HTML support — by design.

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) {
      nodes.push(buf);
      buf = "";
    }
  };

  while (i < text.length) {
    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        nodes.push(<strong key={`b-${i}`}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) {
        flush();
        nodes.push(<em key={`i-${i}`}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return nodes;
}

export function MarkdownLesson({ source }: { source: string }) {
  // Normalize: ensure every heading line is its own block even when the model
  // separated headings from body text with single newlines (common in nested
  // structures). Without this, a `#### sub-heading` glued to the preceding line
  // gets absorbed into that block and renders as literal text.
  const normalized = source.replace(/^[ \t]*(#{1,4}\s[^\n]*)$/gm, "\n$1\n");
  const blocks = normalized.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  const elements: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = (key: number) => {
    if (listBuffer.length === 0) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    elements.push(
      <Tag key={`list-${key}`}>
        {listBuffer.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </Tag>,
    );
    listBuffer = [];
    listType = null;
  };

  blocks.forEach((block, i) => {
    // Headings: check longest prefix first.
    if (block.startsWith("#### ")) {
      flushList(i);
      elements.push(<h4 key={`h4-${i}`}>{renderInline(block.slice(5).trim())}</h4>);
      return;
    }
    if (block.startsWith("### ")) {
      flushList(i);
      elements.push(<h3 key={`h3-${i}`}>{renderInline(block.slice(4).trim())}</h3>);
      return;
    }
    if (block.startsWith("## ")) {
      flushList(i);
      elements.push(<h2 key={`h2-${i}`}>{renderInline(block.slice(3).trim())}</h2>);
      return;
    }
    if (block.startsWith("# ")) {
      flushList(i);
      elements.push(<h2 key={`h1-${i}`}>{renderInline(block.slice(2).trim())}</h2>);
      return;
    }
    if (block.startsWith("> ")) {
      flushList(i);
      const lines = block.split("\n").map((l) => l.replace(/^>\s?/, ""));
      elements.push(<blockquote key={`bq-${i}`}>{renderInline(lines.join(" "))}</blockquote>);
      return;
    }
    if (/^(\d+\.|\-|\*)\s/.test(block)) {
      const lines = block.split("\n");
      const isOrdered = /^\d+\./.test(lines[0]);
      const items = lines.map((l) => l.replace(/^(\d+\.|\-|\*)\s+/, ""));
      if (listType && listType !== (isOrdered ? "ol" : "ul")) flushList(i);
      listType = isOrdered ? "ol" : "ul";
      listBuffer.push(...items);
      return;
    }
    flushList(i);
    elements.push(<p key={`p-${i}`}>{renderInline(block)}</p>);
  });
  flushList(blocks.length);

  return <div className="prose-archive">{elements.map((el, i) => <Fragment key={i}>{el}</Fragment>)}</div>;
}
