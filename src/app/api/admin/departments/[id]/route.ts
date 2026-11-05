import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateDepartmentSchema } from "@/lib/validations/auth";

const departmentIdSchema = z.string().uuid();

async function getAdminContext(id: string) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) {
    return {
      response: NextResponse.json(
        { error: "ไม่มีสิทธิ์ดำเนินการ" },
        { status: context.error === "unauthorized" ? 401 : 403 },
      ),
    };
  }
  if (!departmentIdSchema.safeParse(id).success) {
    return { response: NextResponse.json({ error: "รหัสฝ่ายไม่ถูกต้อง" }, { status: 400 }) };
  }
  return { context, admin: createAdminSupabaseClient() };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getAdminContext(id);
  if (access.response) return access.response;

  const parsed = updateDepartmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const { data, error } = await access.admin
    .from("departments")
    .update(parsed.data)
    .eq("id", id)
    .is("parent_id", null)
    .select("id, name, active")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "มีชื่อฝ่ายนี้อยู่แล้ว" : "แก้ไขฝ่ายไม่สำเร็จ" },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }
  if (!data) return NextResponse.json({ error: "ไม่พบฝ่ายที่ต้องการแก้ไข" }, { status: 404 });

  await access.admin.from("audit_events").insert({
    actor_id: access.context.userId,
    entity_type: "department",
    entity_id: id,
    action: "department_updated",
    safe_diff_json: parsed.data,
  });

  return NextResponse.json({ department: data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getAdminContext(id);
  if (access.response) return access.response;

  const [profilesResult, rolesResult, childrenResult] = await Promise.all([
    access.admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("department_id", id),
    access.admin.from("user_roles").select("id", { count: "exact", head: true }).eq("scoped_department_id", id),
    access.admin.from("departments").select("id", { count: "exact", head: true }).eq("parent_id", id),
  ]);
  const lookupError = profilesResult.error ?? rolesResult.error ?? childrenResult.error;
  if (lookupError) return NextResponse.json({ error: "ตรวจสอบการใช้งานฝ่ายไม่สำเร็จ" }, { status: 500 });

  const usageCount = (profilesResult.count ?? 0) + (rolesResult.count ?? 0) + (childrenResult.count ?? 0);
  if (usageCount > 0) {
    const { data, error } = await access.admin
      .from("departments")
      .update({ active: false })
      .eq("id", id)
      .is("parent_id", null)
      .select("id, name, active")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "ปิดใช้งานฝ่ายไม่สำเร็จ" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "ไม่พบฝ่ายที่ต้องการลบ" }, { status: 404 });

    await access.admin.from("audit_events").insert({
      actor_id: access.context.userId,
      entity_type: "department",
      entity_id: id,
      action: "department_archived",
      safe_diff_json: { active: false, references: usageCount },
    });
    return NextResponse.json({
      department: data,
      mode: "archived",
      message: "ฝ่ายนี้ยังมีข้อมูลอ้างอิง ระบบจึงปิดใช้งานแทนการลบถาวร",
    });
  }

  const { data, error } = await access.admin
    .from("departments")
    .delete()
    .eq("id", id)
    .is("parent_id", null)
    .select("id, name")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "ลบฝ่ายไม่สำเร็จ" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "ไม่พบฝ่ายที่ต้องการลบ" }, { status: 404 });

  await access.admin.from("audit_events").insert({
    actor_id: access.context.userId,
    entity_type: "department",
    entity_id: id,
    action: "department_deleted",
    safe_diff_json: { name: data.name },
  });
  return NextResponse.json({ mode: "deleted", message: "ลบฝ่ายแล้ว" });
}
