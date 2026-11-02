"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Department { id: string; name: string }

export function UserForm({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ username: string; message: string; temporaryPassword?: string } | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, departmentId: body.departmentId || null }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "สร้างบัญชีไม่สำเร็จ"); setPending(false); return; }
    setResult({ username: data.user.username, message: data.initialCredential.message ?? "รหัสผ่านชั่วคราวแสดงครั้งเดียว", temporaryPassword: data.initialCredential.temporaryPassword });
    event.currentTarget.reset(); setPending(false); router.refresh();
  }
  return <form className="form-card" onSubmit={submit}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {result ? <div className="form-success" role="status"><strong>สร้างบัญชี {result.username} สำเร็จ</strong><br />{result.message}{result.temporaryPassword ? <><br />รหัสผ่านชั่วคราว: <code>{result.temporaryPassword}</code> (คัดลอกตอนนี้ ระบบจะไม่แสดงอีก)</> : null}</div> : null}
    <section className="form-section"><h2>ข้อมูลเจ้าหน้าที่</h2><p>เลขประจำตัวต้องเป็นตัวเลข 7 หลัก และอาจมีศูนย์นำหน้า</p><div className="form-grid">
      <div className="field"><label htmlFor="username">เลขประจำตัวเจ้าหน้าที่ *</label><input id="username" name="username" type="text" inputMode="numeric" pattern="[0-9]{7}" maxLength={7} required /></div>
      <div className="field"><label htmlFor="fullName">ชื่อ-นามสกุล *</label><input id="fullName" name="fullName" required /></div>
      <div className="field"><label htmlFor="position">ตำแหน่ง</label><input id="position" name="position" /></div>
      <div className="field"><label htmlFor="departmentId">ฝ่าย/หน่วยงาน</label><select id="departmentId" name="departmentId"><option value="">ไม่ระบุ</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="role">บทบาท</label><select id="role" name="role" defaultValue="staff"><option value="staff">เจ้าหน้าที่</option><option value="supervisor">หัวหน้างาน</option><option value="manager">ผู้บริหาร</option></select></div>
    </div></section>
    <div className="notice" style={{ marginBottom: 20 }}>บัญชี Staff ใช้รหัสผ่านเริ่มต้นตรงกับเลขประจำตัวและถูกบังคับเปลี่ยนทันที บัญชีสิทธิ์สูงจะได้รับรหัสผ่านสุ่มแบบแสดงครั้งเดียว ส่วน Admin ต้องสร้างผ่านกระบวนการสิทธิ์สูงแยกต่างหาก</div>
    <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชี"}</button></div>
  </form>;
}
