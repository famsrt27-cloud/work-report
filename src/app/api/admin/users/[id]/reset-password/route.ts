import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 });
  const { id } = await params;
  const temporaryPassword = `${randomBytes(12).toString("base64url")}aA1!`;
  const admin = createAdminSupabaseClient();
  const { error: authError } = await admin.auth.admin.updateUserById(id, { password: temporaryPassword });
  if (authError) return NextResponse.json({ error: "รีเซ็ตรหัสผ่านไม่สำเร็จ" }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").update({ must_change_password: true }).eq("user_id", id);
  if (profileError) return NextResponse.json({ error: "ตั้งรหัสผ่านแล้ว แต่บันทึกสถานะบังคับเปลี่ยนไม่สำเร็จ โปรดระงับบัญชีและตรวจสอบ" }, { status: 500 });

  await admin.from("audit_events").insert({
    actor_id: context.userId,
    entity_type: "profile",
    entity_id: id,
    action: "password_reset",
    safe_diff_json: { must_change_password: true },
  });
  return NextResponse.json({ temporaryPassword });
}
