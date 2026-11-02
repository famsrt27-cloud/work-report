"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WorkLogForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/tasks/${taskId}/work-logs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "บันทึกไม่สำเร็จ"); setPending(false); return; }
    router.push(`/tasks/${taskId}`); router.refresh();
  }
  const today = new Date().toISOString().slice(0, 10);
  return <form className="form-card" onSubmit={submit}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <section className="form-section"><h2>สิ่งที่ปฏิบัติงาน</h2><p>บันทึกกิจกรรมและผลลัพธ์ที่เกิดขึ้นจริงในวันนี้</p><div className="form-grid">
      <div className="field"><label htmlFor="workDate">วันที่ปฏิบัติงาน *</label><input id="workDate" name="workDate" type="date" defaultValue={today} required /></div><div />
      <div className="field span-2"><label htmlFor="activityDetail">รายละเอียดการปฏิบัติงาน *</label><textarea id="activityDetail" name="activityDetail" required /></div>
      <div className="field span-2"><label htmlFor="resultText">ผลการปฏิบัติงาน *</label><textarea id="resultText" name="resultText" required /></div>
    </div></section>
    <section className="form-section"><h2>ข้อมูลประกอบ</h2><p>ไม่บังคับ ระบบจะคำนวณระยะเวลาเมื่อระบุเวลาเริ่มและสิ้นสุด</p><div className="form-grid">
      <div className="field"><label htmlFor="timeStart">เวลาเริ่ม</label><input id="timeStart" name="timeStart" type="time" /></div>
      <div className="field"><label htmlFor="timeEnd">เวลาสิ้นสุด</label><input id="timeEnd" name="timeEnd" type="time" /></div>
      <div className="field"><label htmlFor="quantity">จำนวนงาน</label><input id="quantity" name="quantity" type="number" min="0" step="0.01" /></div>
      <div className="field"><label htmlFor="unit">หน่วย</label><input id="unit" name="unit" placeholder="เช่น เอกสาร" /></div>
    </div></section>
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => router.back()}>ยกเลิก</button><button className="button button-primary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการปฏิบัติงาน"}</button></div>
  </form>;
}
