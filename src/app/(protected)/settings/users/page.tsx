import { UserForm } from "@/components/admin/user-form";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "จัดการผู้ใช้งาน" };

export default async function UsersSettingsPage() {
  await requireViewer({ roles: ["admin"] });
  const supabase = await createServerSupabaseClient();
  const [departmentResult, profilesResult] = await Promise.all([
    supabase.from("departments").select("id, name").eq("active", true).order("name"),
    supabase.from("profiles").select("user_id, username, full_name, position, is_active, must_change_password").order("full_name").limit(50),
  ]);
  return <main className="content"><div className="page-heading"><div><h1>จัดการผู้ใช้งาน</h1><p>สร้างบัญชีโดยผู้ดูแลระบบเท่านั้น และไม่แสดงรหัสผ่านในรายการผู้ใช้</p></div></div>
    <div className="section-grid"><UserForm departments={departmentResult.data ?? []} /><section className="panel"><div className="panel-head"><h2>บัญชีล่าสุด</h2></div>{profilesResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>เลขประจำตัว</th><th>ชื่อ</th><th>สถานะ</th></tr></thead><tbody>{profilesResult.data.map((profile) => <tr key={profile.user_id}><td className="task-code">{profile.username}</td><td><strong>{profile.full_name}</strong><br /><small>{profile.position || "ไม่ระบุตำแหน่ง"}</small></td><td>{profile.is_active ? (profile.must_change_password ? "รอเปลี่ยนรหัสผ่าน" : "ใช้งาน") : "ระงับ"}</td></tr>)}</tbody></table></div> : <div className="empty">ยังไม่มีบัญชีในขอบเขตที่ดูได้</div>}</section></div>
  </main>;
}
