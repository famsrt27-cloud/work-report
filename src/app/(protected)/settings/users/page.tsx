import { DepartmentManager } from "@/components/admin/department-manager";
import { UserForm } from "@/components/admin/user-form";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "จัดการผู้ใช้งาน" };

export default async function UsersSettingsPage() {
  await requireViewer({ roles: ["admin"] });
  const supabase = await createServerSupabaseClient();
  const [departmentResult, profilesResult, departmentUsageResult] = await Promise.all([
    supabase.from("departments").select("id, name, active").order("active", { ascending: false }).order("name"),
    supabase.from("profiles").select("user_id, username, full_name, position, department_id, is_active, must_change_password").order("full_name").limit(50),
    supabase.from("profiles").select("department_id").not("department_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const profile of departmentUsageResult.data ?? []) {
    if (profile.department_id) counts.set(profile.department_id, (counts.get(profile.department_id) ?? 0) + 1);
  }
  const departments = (departmentResult.data ?? []).map((department) => ({
    ...department,
    userCount: counts.get(department.id) ?? 0,
  }));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  return <main className="content"><div className="page-heading"><div><h1>ผู้ใช้งานและฝ่าย</h1><p>จัดโครงสร้างฝ่ายและสร้างบัญชีเจ้าหน้าที่จากหน้าเดียว</p></div></div>
    <div className="settings-admin-grid"><DepartmentManager departments={departments} /><UserForm departments={departments.filter((department) => department.active)} /></div>
    <section className="panel account-panel"><div className="panel-head"><h2>บัญชีล่าสุด</h2></div>{profilesResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>เลขประจำตัว</th><th>ชื่อ</th><th>ฝ่าย</th><th>สถานะ</th></tr></thead><tbody>{profilesResult.data.map((profile) => <tr key={profile.user_id}><td className="task-code">{profile.username}</td><td><strong>{profile.full_name}</strong><br /><small>{profile.position || "ไม่ระบุตำแหน่ง"}</small></td><td>{profile.department_id ? departmentNames.get(profile.department_id) ?? "ไม่พบข้อมูลฝ่าย" : "ไม่ระบุ"}</td><td><span className={`status ${profile.is_active ? "status-active" : "status-inactive"}`}>{profile.is_active ? (profile.must_change_password ? "รอเปลี่ยนรหัสผ่าน" : "ใช้งาน") : "ระงับ"}</span></td></tr>)}</tbody></table></div> : <div className="empty">ยังไม่มีบัญชีในขอบเขตที่ดูได้</div>}</section>
  </main>;
}
