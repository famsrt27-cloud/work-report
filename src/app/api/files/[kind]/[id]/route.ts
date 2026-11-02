import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const { kind, id } = await params;
  const table = kind === "source" ? "source_documents" : kind === "evidence" ? "evidence_images" : null;
  if (!table) return NextResponse.json({ error: "ประเภทไฟล์ไม่ถูกต้อง" }, { status: 400 });

  const { data } = await context.supabase.from(table).select("bucket, storage_key, original_name").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "ไม่พบไฟล์หรือไม่มีสิทธิ์" }, { status: 404 });
  const admin = createAdminSupabaseClient();
  const { data: signed, error } = await admin.storage.from(data.bucket).createSignedUrl(data.storage_key, 60, { download: data.original_name });
  if (error || !signed) return NextResponse.json({ error: "สร้างลิงก์ไฟล์ไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "private, no-store" } });
}
