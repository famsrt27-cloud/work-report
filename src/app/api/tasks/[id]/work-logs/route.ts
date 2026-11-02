import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { durationBetween, workLogSchema } from "@/lib/validations/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = workLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { id: taskId } = await params;
  const input = parsed.data;
  const { data, error } = await context.supabase.from("work_logs").insert({
    task_id: taskId,
    created_by: context.userId,
    work_date: input.workDate,
    activity_detail: input.activityDetail,
    result_text: input.resultText,
    time_start: input.timeStart || null,
    time_end: input.timeEnd || null,
    duration_minutes: durationBetween(input.timeStart, input.timeEnd),
    quantity: input.quantity ?? null,
    unit: input.unit || null,
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "เพิ่มบันทึกการปฏิบัติงานไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ workLog: data }, { status: 201 });
}
