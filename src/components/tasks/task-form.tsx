"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category { id: string; name: string }

export function TaskForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, categoryId: body.categoryId || null, sourceType: body.sourceType || null }) });
      const result = await response.json().catch(() => null);
      if (!response.ok && response.status !== 207) {
        setError(result?.error ?? "สร้างงานไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }
      if (!result?.task?.id) {
        setError("ระบบไม่ได้รับเลขรายการงาน กรุณาลองอีกครั้ง");
        return;
      }
      router.push(`/tasks/${result.task.id}`); router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }
  const showDocument = sourceType === "document";
  return <form className="form-card" onSubmit={submit}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <section className="form-section"><h2>ข้อมูลงาน</h2><p>ระบุเฉพาะข้อมูลที่ทราบ รายละเอียดที่มาของงานเพิ่มภายหลังได้</p><div className="form-grid">
      <div className="field span-2"><label htmlFor="title">ชื่องาน / ชื่อเรื่อง *</label><input id="title" name="title" maxLength={200} required autoFocus /></div>
      <div className="field span-2"><label htmlFor="description">รายละเอียดงาน / วัตถุประสงค์</label><textarea id="description" name="description" /></div>
      <div className="field"><label htmlFor="categoryId">ประเภทงาน</label><select id="categoryId" name="categoryId"><option value="">งานทั่วไป</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="taskStatus">สถานะงาน</label><select id="taskStatus" name="taskStatus" defaultValue="in_progress"><option value="in_progress">กำลังดำเนินการ</option><option value="completed">เสร็จสิ้น</option><option value="cancelled">ยกเลิก</option></select></div>
      <div className="field"><label htmlFor="receivedDate">วันที่ได้รับงาน</label><input id="receivedDate" name="receivedDate" type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></div>
      <div className="field"><label htmlFor="dueDate">กำหนดส่งงาน</label><input id="dueDate" name="dueDate" type="date" min={receivedDate || undefined} /></div>
    </div></section>
    <section className="form-section"><h2>ที่มาของงาน</h2><p>ทุกช่องในส่วนนี้ไม่บังคับ</p><div className="form-grid">
      <div className="field"><label htmlFor="sourceType">ที่มาของงาน</label><select id="sourceType" name="sourceType" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">ไม่ระบุ</option><option value="document">หนังสือจากต้นเรื่อง</option><option value="person">บุคคลมอบหมาย</option><option value="routine">งานประจำ</option><option value="other">อื่น ๆ</option></select></div>
      <div className="field"><label htmlFor="originatingUnit">หน่วยงานต้นเรื่อง</label><input id="originatingUnit" name="originatingUnit" /></div>
      <div className="field" hidden={sourceType === "routine"}><label htmlFor="assignerName">ผู้มอบหมายงาน</label><input id="assignerName" name="assignerName" /></div><div className="field" hidden={sourceType === "routine"}><label htmlFor="assignerPosition">ตำแหน่งผู้มอบหมาย</label><input id="assignerPosition" name="assignerPosition" /></div>
      <div className="field" hidden={!showDocument}><label htmlFor="referenceNo">เลขที่หนังสือ / คำสั่ง</label><input id="referenceNo" name="referenceNo" /></div><div className="field" hidden={!showDocument}><label htmlFor="referenceDate">วันที่หนังสือ</label><input id="referenceDate" name="referenceDate" type="date" /></div>
      <div className="field span-2"><label htmlFor="sourceNote">หมายเหตุ</label><textarea id="sourceNote" name="sourceNote" /></div>
    </div></section>
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => router.back()}>ยกเลิก</button><button className="button button-primary" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกงาน"}</button></div>
  </form>;
}
