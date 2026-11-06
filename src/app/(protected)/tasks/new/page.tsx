import { TaskForm } from "@/components/tasks/task-form";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "เพิ่มงานใหม่" };

export default async function NewTaskPage() {
  await requireViewer();
  const supabase = await createServerSupabaseClient();
  const [categoryResult, departmentResult] = await Promise.all([
    supabase.from("task_categories").select("id, name").eq("active", true).order("name"),
    supabase.from("departments").select("id, name").eq("active", true).order("name"),
  ]);
  return <main className="content"><div className="page-heading"><div><h1>เพิ่มงานใหม่</h1><p>สร้างรายการหลักครั้งเดียว แล้วเพิ่มบันทึกการปฏิบัติงานได้หลายวัน</p></div></div><TaskForm categories={categoryResult.data ?? []} departments={departmentResult.data ?? []} /></main>;
}
