"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 6;
type DepartmentFilter = "all" | "active" | "inactive";

export interface ManagedDepartment {
  id: string;
  name: string;
  active: boolean;
  userCount: number;
}

export function DepartmentManager({ departments }: { departments: ManagedDepartment[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DepartmentFilter>("all");
  const [page, setPage] = useState(0);
  const activeCount = departments.filter((department) => department.active).length;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("th");
  const filteredDepartments = departments.filter((department) => {
    const matchesSearch = !normalizedQuery || department.name.toLocaleLowerCase("th").includes(normalizedQuery);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? department.active : !department.active);
    return matchesSearch && matchesStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleDepartments = filteredDepartments.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setPage(0);
  }

  async function request(path: string, method: "POST" | "PATCH" | "DELETE", body?: object) {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "ดำเนินการไม่สำเร็จ");
    return data as { message?: string };
  }

  async function addDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingId("new");
    setError("");
    setMessage("");
    try {
      await request("/api/admin/departments", "POST", { name: newName });
      setNewName("");
      setMessage("เพิ่มฝ่ายแล้ว");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เพิ่มฝ่ายไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  async function saveDepartment(id: string) {
    setPendingId(id);
    setError("");
    setMessage("");
    try {
      await request(`/api/admin/departments/${id}`, "PATCH", { name: editingName });
      setEditingId(null);
      setEditingName("");
      setMessage("บันทึกชื่อฝ่ายแล้ว");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "แก้ไขฝ่ายไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  async function removeDepartment(department: ManagedDepartment) {
    const confirmed = window.confirm(
      department.userCount > 0
        ? `ฝ่าย “${department.name}” มีผู้ใช้งาน ${department.userCount} คน ระบบจะปิดใช้งานโดยไม่ลบข้อมูล ต้องการดำเนินการต่อหรือไม่`
        : `ต้องการลบฝ่าย “${department.name}” หรือไม่`,
    );
    if (!confirmed) return;
    setPendingId(department.id);
    setError("");
    setMessage("");
    try {
      const data = await request(`/api/admin/departments/${department.id}`, "DELETE");
      setMessage(data.message ?? "ลบฝ่ายแล้ว");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ลบฝ่ายไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  async function restoreDepartment(id: string) {
    setPendingId(id);
    setError("");
    setMessage("");
    try {
      await request(`/api/admin/departments/${id}`, "PATCH", { active: true });
      setMessage("เปิดใช้งานฝ่ายแล้ว");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เปิดใช้งานฝ่ายไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  }

  return <section className="panel department-panel">
    <div className="panel-head">
      <div><h2>ฝ่าย</h2><p>จัดการตัวเลือกฝ่ายที่ใช้กับบัญชีเจ้าหน้าที่</p></div>
      <div className="department-summary" aria-label={`ฝ่ายที่เปิดใช้งาน ${activeCount} ฝ่าย`}><strong>{activeCount}</strong><span>เปิดใช้งาน</span></div>
    </div>
    <form className="department-create" onSubmit={addDepartment}>
      <input className="filter-control" aria-label="ชื่อฝ่ายใหม่" placeholder="ชื่อฝ่ายใหม่" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={120} required />
      <button className="button button-primary button-compact" disabled={pendingId === "new"}>{pendingId === "new" ? "กำลังเพิ่ม…" : "เพิ่มฝ่าย"}</button>
    </form>
    {error ? <div className="form-error management-feedback" role="alert">{error}</div> : null}
    {message ? <div className="form-success management-feedback" role="status">{message}</div> : null}
    {departments.length ? <>
      <div className="department-list-toolbar">
        <div className="department-search">
          <label className="sr-only" htmlFor="departmentSearch">ค้นหาฝ่าย</label>
          <input id="departmentSearch" className="filter-control" type="search" placeholder="ค้นหาชื่อฝ่าย…" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(0); }} />
        </div>
        <label className="sr-only" htmlFor="departmentStatus">กรองตามสถานะ</label>
        <select id="departmentStatus" className="filter-control" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as DepartmentFilter); setPage(0); }}>
          <option value="all">ทุกสถานะ</option>
          <option value="active">เปิดใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
        <span className="department-result-count" role="status">พบ {filteredDepartments.length} จาก {departments.length} ฝ่าย</span>
      </div>
      {visibleDepartments.length ? <div className="department-list">
      {visibleDepartments.map((department) => <div className={`department-row${department.active ? "" : " is-inactive"}`} key={department.id}>
        {editingId === department.id ? <div className="department-edit">
          <input className="filter-control" aria-label={`แก้ไขชื่อฝ่าย ${department.name}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={120} autoFocus />
          <button type="button" className="button button-primary button-compact" disabled={pendingId === department.id || !editingName.trim()} onClick={() => saveDepartment(department.id)}>บันทึก</button>
          <button type="button" className="button button-ghost button-compact" disabled={pendingId === department.id} onClick={() => setEditingId(null)}>ยกเลิก</button>
        </div> : <>
          <div className="department-main"><strong>{department.name}</strong><div className="department-meta"><span>{department.userCount} ผู้ใช้งาน</span><span className={`status ${department.active ? "status-active" : "status-inactive"}`}>{department.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></div></div>
          <div className="department-actions">
            <button type="button" className="button button-ghost button-compact" disabled={pendingId === department.id} onClick={() => { setEditingId(department.id); setEditingName(department.name); }}>แก้ไข</button>
            {department.active
              ? <button type="button" className="button button-danger button-compact" disabled={pendingId === department.id} onClick={() => removeDepartment(department)}>{pendingId === department.id ? "กำลังดำเนินการ…" : "ลบ"}</button>
              : <><button type="button" className="button button-secondary button-compact" disabled={pendingId === department.id} onClick={() => restoreDepartment(department.id)}>เปิดใช้งาน</button><button type="button" className="button button-danger button-compact" disabled={pendingId === department.id} onClick={() => removeDepartment(department)}>ลบถาวร</button></>}
          </div>
        </>}
      </div>)}
      </div> : <div className="empty department-filter-empty"><strong>ไม่พบฝ่ายที่ตรงกับตัวกรอง</strong><span>ลองเปลี่ยนคำค้นหาหรือสถานะ</span><button type="button" className="text-button" onClick={clearFilters}>ล้างตัวกรอง</button></div>}
      {pageCount > 1 ? <div className="department-pagination" aria-label="แบ่งหน้ารายการฝ่าย">
        <button type="button" className="button button-ghost button-compact" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
        <span>หน้า {currentPage + 1} จาก {pageCount}</span>
        <button type="button" className="button button-ghost button-compact" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
      </div> : null}
    </> : <div className="empty"><strong>ยังไม่มีฝ่าย</strong>เพิ่มฝ่ายแรกเพื่อใช้กับบัญชีเจ้าหน้าที่</div>}
  </section>;
}
