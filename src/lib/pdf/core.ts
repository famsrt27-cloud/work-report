import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const BODY_SIZE = 11;
const LINE_HEIGHT = 18;

const SARABUN_GOOGLE_FONTS_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf";
let sarabunFontPromise: Promise<Uint8Array> | undefined;

async function loadSarabunFont() {
  const candidates = [
    process.env.PDF_SARABUN_FONT_PATH,
    path.join(process.cwd(), "public", "fonts", "Sarabun-Regular.ttf"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return new Uint8Array(await readFile(candidate));
    } catch {
      // Try the next explicit/local candidate.
    }
  }
  // Fixed, audited Google Fonts source only. Report content never controls this URL.
  const response = await fetch(SARABUN_GOOGLE_FONTS_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("โหลดฟอนต์ Sarabun จาก Google Fonts ไม่สำเร็จ กรุณาวาง Sarabun-Regular.ttf ใน public/fonts หรือตั้งค่า PDF_SARABUN_FONT_PATH");
  }
  return new Uint8Array(await response.arrayBuffer());
}

function segmentWords(text: string) {
  const Segmenter = Intl.Segmenter;
  if (Segmenter) return [...new Segmenter("th", { granularity: "word" }).segment(text)].map((part) => part.segment);
  return [...text];
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of segmentWords(paragraph)) {
      const candidate = current + word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current.trimEnd());
  }
  return lines;
}

export interface PdfWriter {
  document: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  y: number;
  addPage(): void;
  text(value: string, options?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gapAfter?: number }): void;
  rule(): void;
  section(title: string): void;
}

export async function createPdfWriter(title: string, subtitle: string): Promise<PdfWriter> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  sarabunFontPromise ??= loadSarabunFont();
  const fontBytes = await sarabunFontPromise;
  const font = await document.embedFont(fontBytes, { subset: true });
  const boldFont = font;
  let page = document.addPage(A4);
  let y = A4[1] - MARGIN;

  const writer: PdfWriter = {
    document,
    font,
    boldFont,
    page,
    y,
    addPage() {
      page = document.addPage(A4);
      y = A4[1] - MARGIN;
      writer.page = page;
      writer.y = y;
    },
    text(value, options = {}) {
      const size = options.size ?? BODY_SIZE;
      const selectedFont = options.bold ? boldFont : font;
      const lineHeight = size * 1.55;
      const lines = wrapText(value, selectedFont, size, A4[0] - MARGIN * 2);
      for (const line of lines) {
        if (y < MARGIN + lineHeight) writer.addPage();
        page.drawText(line || " ", { x: MARGIN, y, size, font: selectedFont, color: options.color ?? rgb(0.11, 0.16, 0.24) });
        y -= lineHeight;
        writer.y = y;
      }
      y -= options.gapAfter ?? 2;
      writer.y = y;
    },
    rule() {
      if (y < MARGIN + 20) writer.addPage();
      page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.7, color: rgb(0.76, 0.81, 0.88) });
      y -= 14;
      writer.y = y;
    },
    section(value) {
      if (y < MARGIN + 40) writer.addPage();
      writer.text(value, { size: 14, bold: true, color: rgb(0.04, 0.24, 0.43), gapAfter: 7 });
    },
  };

  writer.text(title, { size: 20, bold: true, color: rgb(0.03, 0.2, 0.38), gapAfter: 3 });
  writer.text(subtitle, { size: 10, color: rgb(0.37, 0.44, 0.52), gapAfter: 10 });
  writer.rule();
  return writer;
}

export async function appendImagePage(writer: PdfWriter, bytes: Uint8Array, mime: string, caption?: string | null) {
  let imageBytes = bytes;
  let normalizedMime = mime;
  if (mime === "image/webp") {
    const { default: sharp } = await import("sharp");
    imageBytes = new Uint8Array(await sharp(bytes).png().toBuffer());
    normalizedMime = "image/png";
  }
  const image = normalizedMime === "image/png"
    ? await writer.document.embedPng(imageBytes)
    : await writer.document.embedJpg(imageBytes);
  writer.addPage();
  const maxWidth = A4[0] - MARGIN * 2;
  const maxHeight = A4[1] - MARGIN * 2 - 48;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  writer.page.drawImage(image, { x: (A4[0] - width) / 2, y: MARGIN + 34, width, height });
  if (caption) writer.page.drawText(caption.slice(0, 180), { x: MARGIN, y: MARGIN, size: 10, font: writer.font, color: rgb(0.2, 0.25, 0.32) });
}

export async function appendPdfDocuments(document: PDFDocument, sourcePdfs: Array<{ name: string; bytes: Uint8Array }>) {
  for (const source of sourcePdfs) {
    let input: PDFDocument;
    try {
      input = await PDFDocument.load(source.bytes);
    } catch {
      throw new Error(`ไม่สามารถผนวกไฟล์ ${source.name} ได้ ไฟล์อาจเสียหายหรือมีรหัสผ่าน`);
    }
    const pages = await document.copyPages(input, input.getPageIndices());
    pages.forEach((page) => document.addPage(page));
  }
}

export function addPageNumbers(document: PDFDocument, font: PDFFont) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const text = `${index + 1} / ${pages.length}`;
    page.drawText(text, { x: A4[0] - MARGIN - font.widthOfTextAtSize(text, 8), y: 22, size: 8, font, color: rgb(0.45, 0.5, 0.57) });
  });
}
