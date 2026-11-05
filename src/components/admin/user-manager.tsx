"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/types";

interface DepartmentOption {
  id: string;
  name: string;
  active: boolean;
}

export interface ManagedUser {
  id: string;
  username: string;
  fullName: string;
  position: string | null;
  departmentId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  staff: "เจ้าหน้าที่",
  supervisor: "หัวหน้างาน",
  manager: "ผู้บริหาร",
  admin: "ผู้ดูแลระบบ",
};

export function UserManager({
  users,
  departments,
  currentUserId,
}: {
  users: ManagedUser[];
  departments: DepartmentOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  async function apiRequest(path: string, method: "PATCH" | "POST", body?: object) {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "ดำเนินการไม่สำเร็จ");
    return data as { temporaryPassword?: string };
  }

  function clearFeedback() {
    setError("");
    setMessage("");
    setTemporaryPassword("");
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setPendingId(editing.id);
    clearFeedback();
    try {
      await apiRequest(`/api/admin/users/${editing.id}`, "PATCH", {
        fullName: editing.fullName,
        position: editing.position ?? "",
        ...(editing.role === "admin" ? {} : {
          departmentId: editing.departmentId || null,
          role: editing.role,
        }),
      });
      setMessage(`บันทึกข้อมูล ${editing.fullName} แล้ว`);
      setEditing(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "แก้ไขผู้ใช้งานไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  async function toggleActive(user: ManagedUser) {
    const nextActive = !user.isActive;
    if (!nextActive && !window.confirm(`ต้องการระงับบัญชี ${user.fullName} หรือไม่`)) return;
    setPendingId(user.id);
    clearFeedback();
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "PATCH", { isActive: nextActive });
      setMessage(nextActive ? `เปิดใช้งานบัญชี ${user.fullName} แล้ว` : `ระงับบัญชี ${user.fullName} แล้ว`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เปลี่ยนสถานะผู้ใช้งานไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  async function resetPassword(user: ManagedUser) {
    if (!window.confirm(`ต้องการรีเซ็ตรหัสผ่านของ ${user.fullName} หรือไม่`)) return;
    setPendingId(user.id);
    clearFeedback();
    try {
      const data = await apiRequest(`/api/admin/users/${user.id}/reset-password`, "POST");
      setMessage(`รีเซ็ตรหัสผ่านของ ${user.fullName} แล้ว กรุณาคัดลอกรหัสชั่วคราวตอนนี้`);
      setTemporaryPassword(data.temporaryPassword ?? "");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  return <section className="panel account-panel">
    <div className="panel-head"><div><h2>บัญชีผู้ใช้งาน</h2><p className="panel-description">แก้ไขข้อมูล สิทธิ์ สถานะ และรีเซ็ตรหัสผ่าน</p></div><span className="account-count">{users.length} บัญชี</span></div>
    {error ? <div className="form-error management-feedback" role="alert">{error}</div> : null}
    {message ? <div className="form-success management-feedback" role="status">{message}{temporaryPassword ? <><br />รหัสผ่านชั่วคราว: <code className="credential-code">{temporaryPassword}</code></> : null}</div> : null}
    {editing ? <form className="user-edit-panel" onSubmit={saveUser}>
      <div className="user-edit-heading"><div><strong>แก้ไขบัญชี {editing.username}</strong><span>{editing.role === "admin" ? "บัญชี Admin แก้ไขได้เฉพาะชื่อและตำแหน่ง" : "ปรับข้อมูลและขอบเขตสิทธิ์ของผู้ใช้งาน"}</span></div><button type="button" className="text-button" onClick={() => setEditing(null)}>ปิด</button></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="editFullName">ชื่อ-นามสกุล *</label><input id="editFullName" value={editing.fullName} onChange={(event) => setEditing({ ...editing, fullName: event.target.value })} required maxLength={200} /></div>
        <div className="field"><label htmlFor="editPosition">ตำแหน่ง</label><input id="editPosition" value={editing.position ?? ""} onChange={(event) => setEditing({ ...editing, position: event.target.value })} maxLength={200} /></div>
        <div className="field"><label htmlFor="editDepartment">ฝ่าย/หน่วยงาน</label><select id="editDepartment" value={editing.departmentId ?? ""} disabled={editing.role === "admin"} onChange={(event) => setEditing({ ...editing, departmentId: event.target.value || null })}><option value="">ไม่ระบุ</option>{departments.map((department) => <option value={department.id} key={department.id} disabled={!department.active && department.id !== editing.departmentId}>{department.name}{department.active ? "" : " (ปิดใช้งาน)"}</option>)}</select></div>
        <div className="field"><label htmlFor="editRole">บทบาท</label><select id="editRole" value={editing.role} disabled={editing.role === "admin"} onChange={(event) => setEditing({ ...editing, role: event.target.value as AppRole })}><option value="staff">เจ้าหน้าที่</option><option value="supervisor">หัวหน้างาน</option><option value="manager">ผู้บริหาร</option>{editing.role === "admin" ? <option value="admin">ผู้ดูแลระบบ</option> : null}</select></div>
      </div>
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>ยกเลิก</button><button className="button button-primary" disabled={pendingId === editing.id}>{pendingId === editing.id ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button></div>
    </form> : null}
    {users.length ? <div className="table-wrap"><table className="data-table user-table"><thead><tr><th>เลขประจำตัว</th><th>ชื่อ</th><th>ฝ่าย/บทบาท</th><th>สถานะ</th><th><span className="sr-only">คำสั่ง</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td className="task-code">{user.username}</td><td><strong>{user.fullName}</strong><br /><small>{user.position || "ไม่ระบุตำแหน่ง"}</small></td><td>{user.departmentId ? departmentNames.get(user.departmentId) ?? "ไม่พบข้อมูลฝ่าย" : "ไม่ระบุ"}<br /><small>{roleLabels[user.role]}</small></td><td><span className={`status ${user.isActive ? "status-active" : "status-inactive"}`}>{user.isActive ? (user.mustChangePassword ? "รอเปลี่ยนรหัสผ่าน" : "ใช้งาน") : "ระงับ"}</span></td><td><div className="user-actions"><button type="button" className="button button-ghost button-compact" onClick={() => { clearFeedback(); setEditing(user); }}>แก้ไข</button><button type="button" className="button button-secondary button-compact" disabled={pendingId === user.id} onClick={() => resetPassword(user)}>รีเซ็ตรหัสผ่าน</button><button type="button" className={`button ${user.isActive ? "button-danger" : "button-secondary"} button-compact`} disabled={pendingId === user.id || user.id === currentUserId} title={user.id === currentUserId ? "ไม่สามารถระงับบัญชีที่กำลังใช้งาน" : undefined} onClick={() => toggleActive(user)}>{user.isActive ? "ระงับ" : "เปิดใช้งาน"}</button></div></td></tr>)}</tbody></table></div> : <div className="empty"><strong>ยังไม่มีบัญชี</strong>สร้างบัญชีเจ้าหน้าที่จากแบบฟอร์มด้านบน</div>}
  </section>;
}
