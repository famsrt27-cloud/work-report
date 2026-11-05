import { DepartmentManager } from "@/components/admin/department-manager";
import { UserForm } from "@/components/admin/user-form";
import { UserManager } from "@/components/admin/user-manager";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

export const metadata = { title: "จัดการผู้ใช้งาน" };

export default async function UsersSettingsPage() {
  const viewer = await requireViewer({ roles: ["admin"] });
  const supabase = await createServerSupabaseClient();
  const [departmentResult, profilesResult, departmentUsageResult, rolesResult] = await Promise.all([
    supabase.from("departments").select("id, name, active").order("active", { ascending: false }).order("name"),
    supabase.from("profiles").select("user_id, username, full_name, position, department_id, is_active, must_change_password").order("full_name").limit(50),
    supabase.from("profiles").select("department_id").not("department_id", "is", null),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const counts = new Map<string, number>();
  for (const profile of departmentUsageResult.data ?? []) {
    if (profile.department_id) counts.set(profile.department_id, (counts.get(profile.department_id) ?? 0) + 1);
  }
  const departments = (departmentResult.data ?? []).map((department) => ({
    ...department,
    userCount: counts.get(department.id) ?? 0,
  }));
  const rolesByUser = new Map<string, AppRole[]>();
  for (const assignment of rolesResult.data ?? []) {
    const roles = rolesByUser.get(assignment.user_id) ?? [];
    roles.push(assignment.role as AppRole);
    rolesByUser.set(assignment.user_id, roles);
  }
  const rolePriority: AppRole[] = ["admin", "manager", "supervisor", "staff"];
  const users = (profilesResult.data ?? []).map((profile) => ({
    id: profile.user_id,
    username: profile.username,
    fullName: profile.full_name,
    position: profile.position,
    departmentId: profile.department_id,
    isActive: profile.is_active,
    mustChangePassword: profile.must_change_password,
    role: rolePriority.find((role) => rolesByUser.get(profile.user_id)?.includes(role)) ?? "staff",
  }));

  return <main className="content"><div className="page-heading"><div><h1>ผู้ใช้งานและฝ่าย</h1><p>จัดโครงสร้างฝ่ายและสร้างบัญชีเจ้าหน้าที่จากหน้าเดียว</p></div></div>
    <div className="settings-admin-grid"><DepartmentManager departments={departments} /><UserForm departments={departments.filter((department) => department.active)} /></div>
    <UserManager users={users} departments={departments} currentUserId={viewer.user_id} />
  </main>;
}
