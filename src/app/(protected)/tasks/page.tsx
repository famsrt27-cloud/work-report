import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { formatThaiDate } from "@/lib/format";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "รายการงาน" };

export default async function TasksPage() {
  await requireViewer();
  const supabase = await createServerSupabaseClient();
  const { data: tasks } = await supabase.from("tasks").select("id, task_code, title, task_status, due_date, updated_at").order("updated_at", { ascending: false }).limit(50);
  return <main className="content"><div className="page-heading"><div><h1>รายการงาน</h1><p>งานของฉันและงานในทีมตามขอบเขตสิทธิ์</p></div><Link className="button button-primary" href="/tasks/new">เพิ่มงานใหม่</Link></div>
    <div className="list-stack">{tasks?.length ? tasks.map((task) => <Link className="task-row" href={`/tasks/${task.id}`} key={task.id}><div className="task-code">{task.task_code}</div><div className="task-title">{task.title}</div><div className="task-meta">กำหนดส่ง {formatThaiDate(task.due_date)}</div><StatusPill status={task.task_status} /><div className="chevron">›</div></Link>) : <div className="panel empty"><strong>ยังไม่มีรายการงาน</strong>เพิ่มงานแรกได้โดยไม่จำเป็นต้องมีหนังสือต้นเรื่องหรือชื่อผู้มอบหมาย</div>}</div>
  </main>;
}
