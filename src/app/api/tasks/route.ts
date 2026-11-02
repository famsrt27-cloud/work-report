import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { taskSchema } from "@/lib/validations/tasks";

export async function GET(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  let query = context.supabase
    .from("tasks")
    .select("id, task_code, title, task_status, due_date, updated_at, task_categories(name)")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  if (cursor) query = query.lt("updated_at", cursor);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "โหลดรายการงานไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ data, nextCursor: data?.at(-1)?.updated_at ?? null });
}

export async function POST(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = taskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const input = parsed.data;

  const { data: task, error } = await context.supabase.from("tasks").insert({
    task_code: "",
    title: input.title,
    description: input.description || null,
    category_id: input.categoryId ?? null,
    owner_user_id: context.userId,
    received_date: input.receivedDate || null,
    due_date: input.dueDate || null,
    task_status: input.taskStatus,
    created_by: context.userId,
  }).select("id, task_code").single();
  if (error || !task) return NextResponse.json({ error: "สร้างรายการงานไม่สำเร็จ" }, { status: 400 });

  const hasSource = input.sourceType || input.originatingUnit || input.assignerName || input.assignerPosition
    || input.referenceNo || input.referenceDate || input.sourceNote;
  if (hasSource) {
    const { error: sourceError } = await context.supabase.from("task_sources").insert({
      task_id: task.id,
      source_type: input.sourceType ?? null,
      originating_unit: input.originatingUnit || null,
      assigner_name: input.assignerName || null,
      assigner_position: input.assignerPosition || null,
      reference_no: input.referenceNo || null,
      reference_date: input.referenceDate || null,
      source_note: input.sourceNote || null,
    });
    if (sourceError) return NextResponse.json({ error: "สร้างงานแล้ว แต่บันทึกที่มาของงานไม่สำเร็จ", task }, { status: 207 });
  }
  return NextResponse.json({ task }, { status: 201 });
}
