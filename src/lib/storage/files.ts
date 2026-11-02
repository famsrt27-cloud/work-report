import "server-only";

import { createHash, randomUUID } from "node:crypto";

export type AcceptedFileKind = "pdf" | "image";

const allowedImages = new Map([
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
]);

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function inspectUpload(file: File, kind: AcceptedFileKind) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime: string | null = null;

  if (kind === "pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) mime = "application/pdf";
  if (kind === "image") {
    for (const [candidate, signature] of allowedImages) {
      if (startsWith(bytes, signature)) mime = candidate;
    }
    if (
      bytes.length >= 12
      && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
      && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    ) mime = "image/webp";
  }

  if (!mime) throw new Error(kind === "pdf" ? "ไฟล์ต้องเป็น PDF ที่ถูกต้อง" : "รองรับเฉพาะ JPG, PNG หรือ WebP");
  const limit = kind === "pdf" ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
  if (bytes.byteLength === 0 || bytes.byteLength > limit) throw new Error(`ไฟล์ต้องมีขนาดไม่เกิน ${kind === "pdf" ? 20 : 10} MB`);

  return {
    bytes,
    mime,
    size: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    objectName: `${randomUUID()}.${mime === "application/pdf" ? "pdf" : mime.split("/")[1]}`,
  };
}

export function safeOriginalName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240) || "file";
}
