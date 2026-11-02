import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { internalEmailForUsername } from "@/lib/auth/internal-identifier";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: context.error === "unauthorized" ? 401 : 403 });

  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (parsed.data.role === "admin") {
    return NextResponse.json({ error: "บัญชี Admin ต้องสร้างผ่านกระบวนการสิทธิ์สูงและตั้งรหัสผ่านรัดกุมแยกต่างหาก" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const temporaryPassword = parsed.data.role === "staff"
    ? parsed.data.username
    : `${randomBytes(12).toString("base64url")}aA1!`;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: internalEmailForUsername(parsed.data.username),
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { account_type: "work_reporting" },
  });
  if (authError || !authData.user) {
    const duplicate = authError?.message.toLowerCase().includes("already");
    return NextResponse.json({ error: duplicate ? "เลขประจำตัวนี้มีบัญชีอยู่แล้ว" : "สร้างบัญชี Auth ไม่สำเร็จ" }, { status: 400 });
  }

  const userId = authData.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    username: parsed.data.username,
    full_name: parsed.data.fullName,
    position: parsed.data.position || null,
    department_id: parsed.data.departmentId ?? null,
    must_change_password: true,
    is_active: true,
  });
  const { error: roleError } = profileError ? { error: null } : await admin.from("user_roles").insert({
    user_id: userId,
    role: parsed.data.role,
    scoped_department_id: parsed.data.departmentId ?? null,
  });

  if (profileError || roleError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "สร้างข้อมูลผู้ใช้ไม่สำเร็จ ระบบยกเลิกบัญชี Auth แล้ว" }, { status: 500 });
  }

  await admin.from("audit_events").insert({
    actor_id: context.userId,
    entity_type: "profile",
    entity_id: userId,
    action: "user_created",
    safe_diff_json: { username: parsed.data.username, role: parsed.data.role },
  });

  return NextResponse.json({
    user: { id: userId, username: parsed.data.username, fullName: parsed.data.fullName },
    initialCredential: parsed.data.role === "staff"
      ? { mode: "username", message: "รหัสผ่านเริ่มต้นตรงกับเลขประจำตัว และต้องเปลี่ยนเมื่อเข้าครั้งแรก" }
      : { mode: "one_time", temporaryPassword },
  }, { status: 201 });
}
