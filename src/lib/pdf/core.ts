import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFImage, PDFPage, PDFFont, rgb } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const BODY_SIZE = 11;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;

const COLORS = {
  navy: rgb(0.08, 0.22, 0.35),
  ink: rgb(0.12, 0.15, 0.19),
  muted: rgb(0.38, 0.42, 0.47),
  line: rgb(0.74, 0.78, 0.82),
  softLine: rgb(0.87, 0.89, 0.91),
  softBlue: rgb(0.94, 0.96, 0.98),
  paper: rgb(0.985, 0.988, 0.992),
};

const GOOGLE_FONT_BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun";
const fontPromises = new Map<"Regular" | "Bold", Promise<Uint8Array>>();

async function loadSarabunFont(weight: "Regular" | "Bold") {
  const fileName = `Sarabun-${weight}.ttf`;
  const envPath = weight === "Regular" ? process.env.PDF_SARABUN_FONT_PATH : process.env.PDF_SARABUN_BOLD_FONT_PATH;
  const candidates = [envPath, path.join(process.cwd(), "public", "fonts", fileName)]
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return new Uint8Array(await readFile(candidate));
    } catch {
      // Try the next explicit/local candidate.
    }
  }

  const response = await fetch(`${GOOGLE_FONT_BASE}/${fileName}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`โหลดฟอนต์ ${fileName} จาก Google Fonts ไม่สำเร็จ กรุณาวางไฟล์ใน public/fonts`);
  return new Uint8Array(await response.arrayBuffer());
}

function getSarabunFont(weight: "Regular" | "Bold") {
  let promise = fontPromises.get(weight);
  if (!promise) {
    promise = loadSarabunFont(weight);
    fontPromises.set(weight, promise);
  }
  return promise;
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

function centeredX(text: string, font: PDFFont, size: number) {
  return (A4[0] - font.widthOfTextAtSize(text, size)) / 2;
}

export interface PdfInfoItem { label: string; value: string }
export interface PdfMetricItem { label: string; value: string }

export interface PdfWriter {
  document: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  y: number;
  addPage(): void;
  text(value: string, options?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gapAfter?: number; indent?: number }): void;
  rule(): void;
  section(title: string): void;
  infoGrid(items: PdfInfoItem[]): void;
  metricGrid(items: PdfMetricItem[]): void;
}

export async function createPdfWriter(title: string, subtitle: string): Promise<PdfWriter> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([getSarabunFont("Regular"), getSarabunFont("Bold")]);
  const font = await document.embedFont(regularBytes, { subset: true });
  const boldFont = await document.embedFont(boldBytes, { subset: true });
  let page = document.addPage(A4);
  let y = A4[1] - MARGIN;

  function drawContinuationHeader() {
    page.drawText(title, { x: MARGIN, y: A4[1] - 34, size: 9, font: boldFont, color: COLORS.navy });
    page.drawLine({ start: { x: MARGIN, y: A4[1] - 42 }, end: { x: A4[0] - MARGIN, y: A4[1] - 42 }, thickness: 0.6, color: COLORS.line });
    y = A4[1] - 62;
  }

  function addPage() {
    page = document.addPage(A4);
    drawContinuationHeader();
    writer.page = page;
    writer.y = y;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN + 18) addPage();
  }

  const writer: PdfWriter = {
    document,
    font,
    boldFont,
    page,
    y,
    addPage,
    text(value, options = {}) {
      const size = options.size ?? BODY_SIZE;
      const selectedFont = options.bold ? boldFont : font;
      const lineHeight = size * 1.55;
      const indent = options.indent ?? 0;
      const lines = wrapText(value, selectedFont, size, CONTENT_WIDTH - indent);
      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line || " ", { x: MARGIN + indent, y, size, font: selectedFont, color: options.color ?? COLORS.ink });
        y -= lineHeight;
        writer.y = y;
      }
      y -= options.gapAfter ?? 2;
      writer.y = y;
    },
    rule() {
      ensureSpace(20);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.7, color: COLORS.line });
      y -= 14;
      writer.y = y;
    },
    section(value) {
      ensureSpace(38);
      page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_WIDTH, height: 29, color: COLORS.softBlue, borderColor: COLORS.softLine, borderWidth: 0.5 });
      page.drawRectangle({ x: MARGIN, y: y - 24, width: 4, height: 29, color: COLORS.navy });
      page.drawText(value, { x: MARGIN + 13, y: y - 14, size: 12.5, font: boldFont, color: COLORS.navy });
      y -= 37;
      writer.y = y;
    },
    infoGrid(items) {
      const columns = 2;
      const gap = 8;
      const cellWidth = (CONTENT_WIDTH - gap) / columns;
      for (let index = 0; index < items.length; index += columns) {
        const row = items.slice(index, index + columns);
        const values = row.map((item) => wrapText(item.value || "-", font, 10.5, cellWidth - 20));
        const rowHeight = Math.max(48, ...values.map((lines) => 27 + lines.length * 14));
        ensureSpace(rowHeight + 8);
        row.forEach((item, columnIndex) => {
          const x = MARGIN + columnIndex * (cellWidth + gap);
          page.drawRectangle({ x, y: y - rowHeight, width: cellWidth, height: rowHeight, color: COLORS.paper, borderColor: COLORS.softLine, borderWidth: 0.6 });
          page.drawText(item.label, { x: x + 10, y: y - 15, size: 8.5, font: boldFont, color: COLORS.muted });
          values[columnIndex].forEach((line, lineIndex) => {
            page.drawText(line || "-", { x: x + 10, y: y - 31 - lineIndex * 14, size: 10.5, font, color: COLORS.ink });
          });
        });
        y -= rowHeight + 8;
        writer.y = y;
      }
    },
    metricGrid(items) {
      const columns = 3;
      const gap = 8;
      const cellWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
      for (let index = 0; index < items.length; index += columns) {
        const row = items.slice(index, index + columns);
        ensureSpace(62);
        row.forEach((item, columnIndex) => {
          const x = MARGIN + columnIndex * (cellWidth + gap);
          page.drawRectangle({ x, y: y - 54, width: cellWidth, height: 54, color: COLORS.paper, borderColor: COLORS.line, borderWidth: 0.6 });
          page.drawText(item.value, { x: x + 11, y: y - 24, size: 16, font: boldFont, color: COLORS.navy });
          page.drawText(item.label, { x: x + 11, y: y - 41, size: 8.5, font, color: COLORS.muted });
        });
        y -= 62;
        writer.y = y;
      }
    },
  };

  const organizationLine = subtitle.split(" • ")[0] || subtitle;
  page.drawText(organizationLine, { x: centeredX(organizationLine, boldFont, 13), y, size: 13, font: boldFont, color: COLORS.navy });
  y -= 26;
  page.drawText(title, { x: centeredX(title, boldFont, 19), y, size: 19, font: boldFont, color: COLORS.ink });
  y -= 22;
  page.drawText(subtitle, { x: centeredX(subtitle, font, 9.5), y, size: 9.5, font, color: COLORS.muted });
  y -= 15;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1.2, color: COLORS.navy });
  page.drawLine({ start: { x: MARGIN, y: y - 3 }, end: { x: A4[0] - MARGIN, y: y - 3 }, thickness: 0.4, color: COLORS.line });
  y -= 23;
  writer.y = y;
  return writer;
}

async function normalizeImage(document: PDFDocument, bytes: Uint8Array, mime: string) {
  let imageBytes = bytes;
  let normalizedMime = mime;
  if (mime === "image/webp") {
    const { default: sharp } = await import("sharp");
    imageBytes = new Uint8Array(await sharp(bytes).png().toBuffer());
    normalizedMime = "image/png";
  }
  return normalizedMime === "image/png" ? document.embedPng(imageBytes) : document.embedJpg(imageBytes);
}

function drawEvidenceImage(
  writer: PdfWriter,
  image: PDFImage,
  slot: { x: number; y: number; width: number; height: number },
  label: string,
  alignTop: boolean,
) {
  const captionHeight = 24;
  const padding = 10;
  const maxWidth = slot.width - padding * 2;
  const maxHeight = slot.height - captionHeight - padding * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = slot.x + (slot.width - width) / 2;
  const imageAreaBottom = slot.y + captionHeight + padding;
  const imageAreaTop = slot.y + slot.height - padding;
  const y = alignTop ? imageAreaTop - height : imageAreaBottom + (maxHeight - height) / 2;

  writer.page.drawRectangle({ x: slot.x, y: slot.y, width: slot.width, height: slot.height, color: COLORS.paper, borderColor: COLORS.softLine, borderWidth: 0.7 });
  writer.page.drawImage(image, { x, y, width, height });
  writer.page.drawText(label.slice(0, 180), { x: slot.x + padding, y: slot.y + 9, size: 9.5, font: writer.font, color: COLORS.muted });
}

export async function appendEvidencePages(
  writer: PdfWriter,
  images: Array<{ bytes: Uint8Array; mime: string; caption?: string | null }>,
) {
  for (let index = 0; index < images.length; index += 2) {
    const pair = images.slice(index, index + 2);
    const embedded = await Promise.all(pair.map((image) => normalizeImage(writer.document, image.bytes, image.mime)));
    writer.addPage();
    writer.section("ภาคผนวกภาพหลักฐาน");
    const contentTop = writer.y;
    const contentBottom = 54;
    const gap = 12;
    const availableHeight = contentTop - contentBottom;

    if (pair.length === 1) {
      const label = pair[0].caption?.trim() || `ภาพหลักฐานที่ ${index + 1}`;
      drawEvidenceImage(writer, embedded[0], { x: MARGIN, y: contentBottom, width: CONTENT_WIDTH, height: availableHeight }, label, true);
      continue;
    }

    const slotHeight = (availableHeight - gap) / 2;
    pair.forEach((image, pairIndex) => {
      const slotY = contentTop - (pairIndex + 1) * slotHeight - pairIndex * gap;
      const label = image.caption?.trim() || `ภาพหลักฐานที่ ${index + pairIndex + 1}`;
      drawEvidenceImage(writer, embedded[pairIndex], { x: MARGIN, y: slotY, width: CONTENT_WIDTH, height: slotHeight }, label, false);
    });
  }
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
    pages.forEach((sourcePage) => document.addPage(sourcePage));
  }
}

export function addPageNumbers(document: PDFDocument, font: PDFFont, footerText?: string) {
  const pages = document.getPages();
  pages.forEach((currentPage, index) => {
    const pageNumber = `หน้า ${index + 1} / ${pages.length}`;
    currentPage.drawLine({ start: { x: MARGIN, y: 35 }, end: { x: A4[0] - MARGIN, y: 35 }, thickness: 0.35, color: COLORS.softLine });
    if (footerText) currentPage.drawText(footerText, { x: MARGIN, y: 21, size: 7.5, font, color: COLORS.muted });
    currentPage.drawText(pageNumber, { x: A4[0] - MARGIN - font.widthOfTextAtSize(pageNumber, 7.5), y: 21, size: 7.5, font, color: COLORS.muted });
  });
}
