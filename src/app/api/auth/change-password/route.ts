import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { changePasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const context = await getApiViewer({ allowPasswordChange: true });
  if (context.error) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (parsed.data.newPassword === context.profile.username) {
    return NextResponse.json({ error: "รหัสผ่านใหม่ต้องไม่ตรงกับเลขประจำตัวเจ้าหน้าที่" }, { status: 400 });
  }

  const { error: passwordError } = await context.supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (passwordError) return NextResponse.json({ error: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาตรวจรูปแบบแล้วลองใหม่" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", context.userId);
  if (profileError) return NextResponse.json({ error: "บันทึกสถานะบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });

  await admin.from("audit_events").insert({
    actor_id: context.userId,
    entity_type: "profile",
    entity_id: context.userId,
    action: "password_changed",
    safe_diff_json: {},
  });
  await context.supabase.auth.signOut({ scope: "others" });
  return NextResponse.json({ redirectTo: "/dashboard" });
}
