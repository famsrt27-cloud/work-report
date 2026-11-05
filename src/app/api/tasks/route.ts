import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { taskSchema } from "@/lib/validations/tasks";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function logDatabaseError(operation: string, error: DatabaseError) {
  console.error(`[tasks:${operation}] database error`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function taskInsertErrorMessage(error: DatabaseError) {
  if (error.code === "23514" && error.message?.includes("tasks_due_after_received")) {
    return "กำหนดส่งต้องไม่ก่อนวันที่รับงาน";
  }
  if (error.code === "23503") return "ประเภทงานหรือข้อมูลผู้ใช้งานไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";
  if (error.code === "42501") return "บัญชีนี้ไม่มีสิทธิ์สร้างรายการงาน กรุณาติดต่อผู้ดูแลระบบ";
  return "สร้างรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง";
}

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
  if (error) {
    logDatabaseError("insert", error);
    return NextResponse.json({ error: taskInsertErrorMessage(error) }, { status: 400 });
  }
  if (!task) {
    console.error("[tasks:insert] database returned no task and no error");
    return NextResponse.json({ error: "สร้างรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

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
    if (sourceError) {
      logDatabaseError("insert-source", sourceError);
      return NextResponse.json({ error: "สร้างงานแล้ว แต่บันทึกที่มาของงานไม่สำเร็จ", task }, { status: 207 });
    }
  }
  return NextResponse.json({ task }, { status: 201 });
}
