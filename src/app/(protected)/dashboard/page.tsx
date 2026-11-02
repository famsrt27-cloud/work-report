import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { formatThaiDate } from "@/lib/format";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [tasksResult, logsResult, notificationsResult] = await Promise.all([
    supabase.from("tasks").select("id, task_code, title, task_status, due_date, updated_at").order("updated_at", { ascending: false }).limit(20),
    supabase.from("work_logs").select("id, task_id, duration_minutes").eq("created_by", viewer.user_id).gte("work_date", monthStart).lte("work_date", monthEnd),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const tasks = tasksResult.data ?? [];
  const logs = logsResult.data ?? [];
  const uniqueTaskIds = new Set(logs.map((log) => log.task_id));
  const duration = logs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const overdue = tasks.filter((task) => task.due_date && task.due_date < today && task.task_status === "in_progress").length;
  const dueSoon = tasks.filter((task) => task.due_date && task.due_date >= today && task.due_date <= new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10) && task.task_status === "in_progress").length;

  return <main className="content">
    <div className="page-heading"><div><h1>สวัสดี, {viewer.full_name.split(" ")[0]}</h1><p>ภาพรวมงานและสิ่งที่ต้องจัดการในช่วงนี้</p></div><div className="heading-actions"><Link className="button button-primary" href="/tasks/new">เพิ่มงานใหม่</Link></div></div>
    <section className="action-strip" aria-label="สิ่งที่ต้องจัดการ">
      <div><h2>วันนี้ต้องจัดการอะไร</h2><p>ตรวจงานใกล้กำหนด เพิ่มบันทึกการปฏิบัติงาน และติดตามการแจ้งเตือนจากทีม</p></div>
      <div><strong>{dueSoon}</strong><span>งานใกล้กำหนด 7 วัน</span></div>
      <div><strong>{overdue}</strong><span>งานเกินกำหนด</span></div>
      <div><strong>{notificationsResult.count ?? 0}</strong><span>การแจ้งเตือนที่ยังไม่อ่าน</span></div>
    </section>
    <section className="metric-grid" aria-label="ตัวชี้วัดประจำเดือน">
      <div className="metric"><span>งานไม่ซ้ำเดือนนี้</span><strong>{uniqueTaskIds.size}</strong><small>นับจากบันทึกการปฏิบัติงาน</small></div>
      <div className="metric"><span>บันทึกการปฏิบัติงาน</span><strong>{logs.length}</strong><small>รายการในเดือนนี้</small></div>
      <div className="metric"><span>ชั่วโมงที่บันทึก</span><strong>{Math.round(duration / 6) / 10}</strong><small>เฉพาะรายการที่ระบุเวลา</small></div>
      <div className={`metric ${overdue ? "is-warn" : ""}`}><span>งานเกินกำหนด</span><strong>{overdue}</strong><small>{overdue ? "ควรตรวจสอบ" : "ไม่มีงานค้างเกินกำหนด"}</small></div>
    </section>
    <section className="panel">
      <div className="panel-head"><h2>งานที่เคลื่อนไหวล่าสุด</h2><Link className="text-button" href="/tasks">ดูทั้งหมด</Link></div>
      {tasks.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>เลขที่งาน</th><th>ชื่องาน</th><th>กำหนดส่ง</th><th>สถานะ</th></tr></thead><tbody>{tasks.slice(0, 8).map((task) => <tr key={task.id}><td className="task-code">{task.task_code}</td><td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td><td>{formatThaiDate(task.due_date)}</td><td><StatusPill status={task.task_status} /></td></tr>)}</tbody></table></div> : <div className="empty"><strong>เริ่มบันทึกงานแรก</strong>สร้างรายการงาน แล้วเพิ่มบันทึกการปฏิบัติงานได้หลายวัน</div>}
    </section>
  </main>;
}
