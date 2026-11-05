import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createDepartmentSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const context = await getApiViewer({ roles: ["admin"] });
  if (context.error) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ดำเนินการ" },
      { status: context.error === "unauthorized" ? 401 : 403 },
    );
  }

  const parsed = createDepartmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("departments")
    .insert({ name: parsed.data.name, parent_id: null, active: true })
    .select("id, name, active")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "มีชื่อฝ่ายนี้อยู่แล้ว" : "เพิ่มฝ่ายไม่สำเร็จ" },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  await admin.from("audit_events").insert({
    actor_id: context.userId,
    entity_type: "department",
    entity_id: data.id,
    action: "department_created",
    safe_diff_json: { name: data.name, active: data.active },
  });

  return NextResponse.json({ department: data }, { status: 201 });
}
