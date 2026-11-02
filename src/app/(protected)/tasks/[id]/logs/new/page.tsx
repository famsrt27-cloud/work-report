import { notFound } from "next/navigation";
import { WorkLogForm } from "@/components/tasks/work-log-form";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewWorkLogPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: task } = await supabase.from("tasks").select("id, task_code, title").eq("id", id).single();
  if (!task) notFound();
  return <main className="content"><div className="page-heading"><div><div className="task-code">{task.task_code}</div><h1>เพิ่มบันทึกการปฏิบัติงาน</h1><p>{task.title}</p></div></div><WorkLogForm taskId={task.id} /></main>;
}
