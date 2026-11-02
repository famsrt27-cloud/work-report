import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";

const schema = z.object({
  caption: z.string().trim().max(500).nullable().optional(),
  evidenceType: z.string().trim().max(100).nullable().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  includeInPdf: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { id } = await params;
  const { data, error } = await context.supabase.from("evidence_images").update({
    caption: parsed.data.caption,
    evidence_type: parsed.data.evidenceType,
    display_order: parsed.data.displayOrder,
    include_in_pdf: parsed.data.includeInPdf,
  }).eq("id", id).select("id, caption, evidence_type, display_order, include_in_pdf").single();
  if (error || !data) return NextResponse.json({ error: "แก้ไขรูปหลักฐานไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ evidence: data });
}
