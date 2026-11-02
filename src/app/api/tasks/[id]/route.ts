import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { taskSchema } from "@/lib/validations/tasks";
import type { Database } from "@/types/database";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await context.supabase.from("tasks").select("*, task_sources(*), source_documents(*), work_logs(*, evidence_images(*))").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = taskSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { id } = await params;
  const input = parsed.data;
  const update: Database["public"]["Tables"]["tasks"]["Update"] = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description || null;
  if (input.categoryId !== undefined) update.category_id = input.categoryId;
  if (input.receivedDate !== undefined) update.received_date = input.receivedDate || null;
  if (input.dueDate !== undefined) update.due_date = input.dueDate || null;
  if (input.taskStatus !== undefined) update.task_status = input.taskStatus;
  if (!Object.keys(update).length) return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
  const { data, error } = await context.supabase.from("tasks").update(update).eq("id", id).select("id, task_code, updated_at").single();
  if (error || !data) return NextResponse.json({ error: "แก้ไขงานไม่สำเร็จหรือไม่มีสิทธิ์" }, { status: 400 });
  return NextResponse.json({ task: data });
}
