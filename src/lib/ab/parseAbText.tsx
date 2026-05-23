import React from "react";

/**
 * Parse A/B test text with inline formatting:
 * - *text* → bold
 * - _text_ → italic
 * - {text} → gold/accent color (#F4A623)
 *
 * Returns React elements for rendering.
 */
export function parseAbText(text: string): React.ReactNode {
  if (!text) return text;
  // No markers? Return plain text
  if (!text.includes("*") && !text.includes("_") && !text.includes("{")) return text;

  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    // Bold: *text*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) {
        parts.push(<strong key={key++}>{text.slice(i + 1, end)}</strong>);
        i = end + 1;
        continue;
      }
    }
    // Italic: _text_
    if (text[i] === "_") {
      const end = text.indexOf("_", i + 1);
      if (end > i) {
        parts.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    // Color: {text}
    if (text[i] === "{") {
      const end = text.indexOf("}", i + 1);
      if (end > i) {
        parts.push(<span key={key++} style={{ color: "#F4A623" }}>{text.slice(i + 1, end)}</span>);
        i = end + 1;
        continue;
      }
    }
    // Plain text — collect until next marker
    let next = text.length;
    for (const ch of ["*", "_", "{"]) {
      const idx = text.indexOf(ch, i + 1);
      if (idx > -1 && idx < next) next = idx;
    }
    // Include current char
    if (next === text.length) {
      parts.push(text.slice(i));
      break;
    }
    parts.push(text.slice(i, next));
    i = next;
  }

  return <>{parts}</>;
}
