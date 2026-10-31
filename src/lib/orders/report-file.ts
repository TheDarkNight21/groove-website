import readXlsxFile from "read-excel-file/node";
import type { Result } from "../email";
import { parseCsv } from "./csv";

// Decodes an uploaded report into a table of strings. The library throws on a bad
// file; that becomes a value here and nowhere else.

export type FileError = { readonly kind: "unsupported"; readonly name: string } | { readonly kind: "unreadable"; readonly detail: string };

export const MAX_REPORT_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request cap

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

export async function readReportFile(name: string, bytes: Buffer): Promise<Result<string[][], FileError>> {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".csv")) return { ok: true, value: parseCsv(bytes.toString("utf8")) };
    if (lower.endsWith(".xlsx")) {
      // Keep numbers as the text Excel stored: a 22-digit USPS tracking number is past
      // Number's precision, and a ZIP must keep its leading zero.
      const sheets = await readXlsxFile<string>(bytes, { parseNumber: (s) => s });
      const first = sheets[0]?.data ?? [];
      return { ok: true, value: first.map((row) => row.map(cellText)) };
    }
    return { ok: false, error: { kind: "unsupported", name } };
  } catch (e) {
    return { ok: false, error: { kind: "unreadable", detail: e instanceof Error ? e.message : String(e) } };
  }
}
