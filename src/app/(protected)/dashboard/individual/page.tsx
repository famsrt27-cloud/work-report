import { IndividualDashboard } from "@/components/dashboard/individual-dashboard";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard รายบุคคล" };

export default async function IndividualDashboardPage() {
  const viewer = await requireViewer();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("profiles").select("user_id, full_name, position").eq("is_active", true).order("full_name");
  const employees = data?.length ? data : [{ user_id: viewer.user_id, full_name: viewer.full_name, position: viewer.position }];
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return <main className="content"><div className="page-heading"><div><h1>Dashboard รายบุคคล</h1><p>เลือกเจ้าหน้าที่และเดือนเพื่อดูผลงานจากข้อมูลชุดเดียวกับรายงาน PDF</p></div></div><IndividualDashboard employees={employees} initialUserId={viewer.user_id} initialMonth={month} /></main>;
}
