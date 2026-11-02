import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";

export async function GET() {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const { data, error } = await context.supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", parsed.data.ids);
  if (error) return NextResponse.json({ error: "บันทึกสถานะไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ updated: parsed.data.ids.length });
}
