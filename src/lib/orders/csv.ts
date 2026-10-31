// RFC 4180 CSV, both directions. Every field is written quoted, so a ZIP like
// "02134" is unambiguously text and parse(serialize(rows)) gives the rows back exactly.

const quote = (field: string): string => `"${field.replace(/"/g, '""')}"`;

export const serializeCsv = (rows: readonly (readonly string[])[]): string =>
  rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";

// Parses quoted and unquoted fields, "" escapes, and CRLF / LF / CR line ends.
// A trailing newline does not make an extra row; a leading UTF-8 BOM is dropped.
export function parseCsv(text: string): string[][] {
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Local mutation only: the accumulators never escape until the immutable result is returned.
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += c;
      }
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" || c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (c === "\r" && src[i + 1] === "\n") i += 1;
    } else {
      field += c;
    }
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
