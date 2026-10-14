import path from "node:path";
import { parse } from "csv-parse/sync";
import type { DocumentType } from "./types.js";
import { AppError } from "./errors.js";

const extensions: Record<string, DocumentType> = { ".pdf": "pdf", ".txt": "txt", ".csv": "csv" };
const mimes: Record<DocumentType, string[]> = {
  pdf: ["application/pdf"], txt: ["text/plain"], csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"]
};

export function validateUpload(file: Pick<Express.Multer.File, "originalname" | "mimetype" | "buffer" | "size">): DocumentType {
  const basename = path.basename(file.originalname);
  if (!basename || basename !== file.originalname || /[\x00-\x1f<>:"/\\|?*]/.test(basename)) throw new AppError(400, "Filename is unsafe.", "UNSAFE_FILENAME");
  const type = extensions[path.extname(basename).toLowerCase()];
  if (!type || !mimes[type].includes(file.mimetype.toLowerCase())) throw new AppError(415, `Unsupported file: ${basename}. Use PDF, TXT, or CSV.`, "UNSUPPORTED_FILE");
  if (!file.size || file.buffer.length === 0) throw new AppError(400, `${basename} is empty.`, "EMPTY_FILE");
  if (type === "pdf" && file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new AppError(400, `${basename} does not have a valid PDF signature.`, "INVALID_SIGNATURE");
  if (type !== "pdf" && file.buffer.includes(0)) throw new AppError(400, `${basename} appears to contain binary data.`, "INVALID_CONTENT");
  return type;
}

export async function extractText(file: Express.Multer.File, type: DocumentType): Promise<{ text: string; metadata: Record<string, unknown> }> {
  let text = "";
  const metadata: Record<string, unknown> = {};
  try {
    if (type === "pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(file.buffer), useSystemFonts: true }).promise;
      metadata.pageCount = pdf.numPages;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
      }
      text = pages.join("\n");
    } else {
      text = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
      if (type === "csv") {
        const records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: false, trim: true }) as Record<string, string>[];
        metadata.rowCount = records.length;
        metadata.columns = records[0] ? Object.keys(records[0]) : [];
        text = records.map(record => Object.entries(record).map(([key, value]) => `${key}: ${value}`).join(" | ")).join("\n");
      }
    }
  } catch {
    throw new AppError(422, `${file.originalname} could not be read or is malformed.`, "EXTRACTION_FAILED");
  }
  text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!text) throw new AppError(422, `${file.originalname} contains no extractable text.`, "NO_TEXT");
  return { text, metadata };
}
