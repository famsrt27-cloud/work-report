import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";

const querySchema = z.object({
  userId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function GET(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ userId: url.searchParams.get("user_id"), month: url.searchParams.get("month") });
  if (!parsed.success) return NextResponse.json({ error: "ตัวกรองไม่ถูกต้อง" }, { status: 400 });

  const [year, month] = parsed.data.month.split("-").map(Number);
  const periodStart = `${parsed.data.month}-01`;
  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [profileResult, logsResult] = await Promise.all([
    context.supabase.from("profiles").select("user_id, full_name, position, department_id").eq("user_id", parsed.data.userId).single(),
    context.supabase
      .from("work_logs")
      .select("id, task_id, work_date, result_text, duration_minutes, tasks!inner(id, task_code, title, task_status, due_date, category_id, task_categories(name), task_sources(source_type, reference_no))")
      .eq("created_by", parsed.data.userId)
      .gte("work_date", periodStart)
      .lte("work_date", periodEnd)
      .order("work_date", { ascending: false }),
  ]);
  if (!profileResult.data) return NextResponse.json({ error: "ไม่พบเจ้าหน้าที่หรือไม่มีสิทธิ์" }, { status: 404 });
  if (logsResult.error) return NextResponse.json({ error: "โหลดข้อมูล Dashboard ไม่สำเร็จ" }, { status: 500 });

  const logs = logsResult.data ?? [];
  const taskIds = [...new Set(logs.map((log) => log.task_id))];
  const { data: history } = taskIds.length
    ? await context.supabase.from("task_status_history").select("task_id, new_status, changed_at").in("task_id", taskIds).lte("changed_at", `${periodEnd}T23:59:59.999+07:00`).order("changed_at", { ascending: false })
    : { data: [] };
  const statusAtEnd = new Map<string, string>();
  for (const item of history ?? []) if (!statusAtEnd.has(item.task_id)) statusAtEnd.set(item.task_id, item.new_status);

  const taskMap = new Map<string, (typeof logs)[number]["tasks"]>();
  let durationMinutes = 0;
  for (const log of logs) {
    taskMap.set(log.task_id, log.tasks);
    durationMinutes += log.duration_minutes ?? 0;
  }
  const tasks = [...taskMap.values()];
  const statuses = tasks.map((task) => statusAtEnd.get(task.id) ?? task.task_status);
  const categoryCounts = new Map<string, number>();
  for (const task of tasks) {
    const name = task.task_categories?.name ?? "งานทั่วไป";
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }

  return NextResponse.json({
    profile: profileResult.data,
    period: { start: periodStart, end: periodEnd },
    metrics: {
      uniqueTasks: taskIds.length,
      workLogs: logs.length,
      completed: statuses.filter((status) => status === "completed").length,
      inProgress: statuses.filter((status) => status === "in_progress").length,
      cancelled: statuses.filter((status) => status === "cancelled").length,
      durationMinutes,
      overdue: tasks.filter((task) => task.due_date && task.due_date < periodEnd && (statusAtEnd.get(task.id) ?? task.task_status) === "in_progress").length,
    },
    categories: [...categoryCounts].map(([name, count]) => ({ name, count })),
    tasks: tasks.map((task) => ({ ...task, statusAtPeriodEnd: statusAtEnd.get(task.id) ?? task.task_status })),
    logs,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
