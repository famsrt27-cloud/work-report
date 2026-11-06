import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";
import { cleanupStoredFiles } from "@/lib/storage/cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ mode: z.enum(["expired", "all"]) });

export async function POST(request: Request) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ดำเนินการ" },
      { status: context.error === "unauthorized" ? 401 : 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "รูปแบบการล้างไฟล์ไม่ถูกต้อง" }, { status: 400 });

  try {
    const before = parsed.data.mode === "expired" ? new Date(Date.now() - 24 * 60 * 60 * 1000) : undefined;
    const result = await cleanupStoredFiles({ before, actorId: context.userId });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[admin:storage-cleanup] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "ล้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
