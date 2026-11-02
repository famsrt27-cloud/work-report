import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";
import { generateMonthlyReport } from "@/lib/pdf/generate-monthly";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function POST(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ตัวเลือกรายงานไม่ถูกต้อง" }, { status: 400 });
  const [year, monthNumber] = parsed.data.month.split("-").map(Number);
  const start = `${parsed.data.month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const [profileResult, logsResult] = await Promise.all([
    context.supabase.from("profiles").select("full_name, position, departments(name)").eq("user_id", parsed.data.userId).single(),
    context.supabase.from("work_logs").select("id, task_id, work_date, result_text, duration_minutes, tasks!inner(task_code, title, task_status, due_date)").eq("created_by", parsed.data.userId).gte("work_date", start).lte("work_date", end).order("work_date", { ascending: false }),
  ]);
  if (!profileResult.data || logsResult.error) return NextResponse.json({ error: "โหลดข้อมูลรายงานไม่สำเร็จหรือไม่มีสิทธิ์" }, { status: 404 });
  const logs = logsResult.data ?? [];
  const taskMap = new Map<string, { task_code: string; title: string; task_status: "in_progress" | "completed" | "cancelled"; due_date: string | null; latestResult: string; workDate: string }>();
  let durationMinutes = 0;
  for (const log of logs) {
    durationMinutes += log.duration_minutes ?? 0;
    if (!taskMap.has(log.task_id)) taskMap.set(log.task_id, { ...log.tasks, latestResult: log.result_text, workDate: log.work_date });
  }
  const taskIds = [...taskMap.keys()];
  const { data: history } = taskIds.length
    ? await context.supabase.from("task_status_history").select("task_id, new_status, changed_at").in("task_id", taskIds).lte("changed_at", `${end}T23:59:59.999+07:00`).order("changed_at", { ascending: false })
    : { data: [] };
  const statusAtEnd = new Map<string, "in_progress" | "completed" | "cancelled">();
  for (const item of history ?? []) if (!statusAtEnd.has(item.task_id)) statusAtEnd.set(item.task_id, item.new_status);
  const tasks = [...taskMap.entries()].map(([taskId, task]) => ({ ...task, task_status: statusAtEnd.get(taskId) ?? task.task_status }));
  try {
    const bytes = await generateMonthlyReport({
      month: parsed.data.month,
      profile: {
        full_name: profileResult.data.full_name,
        position: profileResult.data.position,
        departmentName: Array.isArray(profileResult.data.departments) ? profileResult.data.departments[0]?.name : profileResult.data.departments?.name,
      },
      metrics: {
        uniqueTasks: tasks.length,
        workLogs: logs.length,
        completed: tasks.filter((task) => task.task_status === "completed").length,
        inProgress: tasks.filter((task) => task.task_status === "in_progress").length,
        cancelled: tasks.filter((task) => task.task_status === "cancelled").length,
        durationMinutes,
        overdue: tasks.filter((task) => task.due_date && task.due_date < end && task.task_status === "in_progress").length,
      },
      tasks,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="monthly-${parsed.data.month}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ" }, { status: 500 });
  }
}
