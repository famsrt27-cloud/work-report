import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateUserSchema } from "@/lib/validations/auth";

const userIdSchema = z.string().uuid();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ดำเนินการ" },
      { status: context.error === "unauthorized" ? 401 : 403 },
    );
  }

  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "รหัสผู้ใช้งานไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }
  if (id === context.userId && parsed.data.isActive === false) {
    return NextResponse.json({ error: "ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const [profileResult, rolesResult] = await Promise.all([
    admin.from("profiles").select("user_id, full_name, position, department_id, is_active").eq("user_id", id).maybeSingle(),
    admin.from("user_roles").select("id, role, scoped_department_id").eq("user_id", id),
  ]);
  if (profileResult.error || rolesResult.error) {
    return NextResponse.json({ error: "โหลดข้อมูลผู้ใช้งานไม่สำเร็จ" }, { status: 500 });
  }
  if (!profileResult.data) return NextResponse.json({ error: "ไม่พบผู้ใช้งาน" }, { status: 404 });

  const currentRoles = rolesResult.data ?? [];
  const isAdmin = currentRoles.some((role) => role.role === "admin");
  const updatesScope = parsed.data.role !== undefined || parsed.data.departmentId !== undefined;
  if (isAdmin && updatesScope) {
    return NextResponse.json({ error: "บัญชี Admin แก้ไขบทบาทหรือฝ่ายผ่านหน้านี้ไม่ได้" }, { status: 400 });
  }
  if (updatesScope && currentRoles.length !== 1) {
    return NextResponse.json({ error: "บัญชีนี้มีหลายบทบาท กรุณาตรวจสอบสิทธิ์ก่อนแก้ไข" }, { status: 409 });
  }

  const nextDepartmentId = parsed.data.departmentId !== undefined
    ? parsed.data.departmentId
    : profileResult.data.department_id;
  if (
    parsed.data.departmentId
    && parsed.data.departmentId !== profileResult.data.department_id
  ) {
    const { data: department, error } = await admin
      .from("departments")
      .select("id")
      .eq("id", parsed.data.departmentId)
      .eq("active", true)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "ตรวจสอบฝ่ายไม่สำเร็จ" }, { status: 500 });
    if (!department) return NextResponse.json({ error: "ฝ่ายที่เลือกปิดใช้งานหรือไม่มีอยู่แล้ว" }, { status: 400 });
  }

  const currentRole = currentRoles[0];
  let roleUpdated = false;
  if (updatesScope && currentRole) {
    const { error } = await admin
      .from("user_roles")
      .update({
        role: parsed.data.role ?? currentRole.role,
        scoped_department_id: nextDepartmentId,
      })
      .eq("id", currentRole.id);
    if (error) return NextResponse.json({ error: "บันทึกบทบาทผู้ใช้งานไม่สำเร็จ" }, { status: 500 });
    roleUpdated = true;
  }

  const profilePatch: {
    full_name?: string;
    position?: string | null;
    department_id?: string | null;
    is_active?: boolean;
  } = {};
  if (parsed.data.fullName !== undefined) profilePatch.full_name = parsed.data.fullName;
  if (parsed.data.position !== undefined) profilePatch.position = parsed.data.position || null;
  if (parsed.data.departmentId !== undefined) profilePatch.department_id = parsed.data.departmentId;
  if (parsed.data.isActive !== undefined) profilePatch.is_active = parsed.data.isActive;

  let updatedProfile = profileResult.data;
  if (Object.keys(profilePatch).length > 0) {
    const { data, error } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", id)
      .select("user_id, full_name, position, department_id, is_active, must_change_password")
      .single();
    if (error) {
      if (roleUpdated && currentRole) {
        await admin.from("user_roles").update({
          role: currentRole.role,
          scoped_department_id: currentRole.scoped_department_id,
        }).eq("id", currentRole.id);
      }
      return NextResponse.json({ error: "บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ" }, { status: 500 });
    }
    updatedProfile = data;
  }

  await admin.from("audit_events").insert({
    actor_id: context.userId,
    entity_type: "profile",
    entity_id: id,
    action: "user_updated",
    safe_diff_json: {
      fields: Object.keys(parsed.data),
      role: parsed.data.role ?? null,
      department_id: parsed.data.departmentId ?? null,
      is_active: parsed.data.isActive ?? null,
    },
  });

  return NextResponse.json({
    user: updatedProfile,
    role: parsed.data.role ?? currentRole?.role ?? null,
  });
}
