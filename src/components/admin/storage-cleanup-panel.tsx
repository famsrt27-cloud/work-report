"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CleanupResult {
  deleted: number;
  documentsDeleted: number;
  imagesDeleted: number;
}

export function StorageCleanupPanel({ documentCount, imageCount }: { documentCount: number; imageCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<"expired" | "all" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function cleanup(mode: "expired" | "all") {
    const confirmed = window.confirm(
      mode === "all"
        ? "ไฟล์เอกสารต้นเรื่องและรูปหลักฐานทั้งหมดจะถูกลบถาวร และจะไม่แสดงใน PDF อีก ต้องการดำเนินการต่อหรือไม่"
        : "ไฟล์เอกสารต้นเรื่องและรูปหลักฐานที่เก่ากว่า 24 ชั่วโมงจะถูกลบถาวร ต้องการดำเนินการต่อหรือไม่",
    );
    if (!confirmed) return;

    setPending(mode);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/storage/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await response.json().catch(() => null) as { error?: string; result?: CleanupResult } | null;
      if (!response.ok || !body?.result) throw new Error(body?.error ?? "ล้างไฟล์ไม่สำเร็จ");
      setMessage(`ลบแล้ว ${body.result.deleted} ไฟล์ (เอกสาร ${body.result.documentsDeleted}, รูปภาพ ${body.result.imagesDeleted})`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ล้างไฟล์ไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }

  return <section className="panel storage-cleanup-panel">
    <div className="panel-head">
      <div><h2>พื้นที่จัดเก็บไฟล์</h2><p className="panel-description">ระบบลบไฟล์ที่มีอายุเกิน 24 ชั่วโมงทุกวัน เวลา 01:00 น. และผู้ดูแลสามารถล้างได้ทันที</p></div>
      <div className="storage-counts" aria-label={`เอกสาร ${documentCount} ไฟล์ รูปภาพ ${imageCount} ไฟล์`}>
        <span><strong>{documentCount}</strong> เอกสาร</span>
        <span><strong>{imageCount}</strong> รูปภาพ</span>
      </div>
    </div>
    <div className="storage-cleanup-body">
      <div className="notice storage-retention-note">การลบเป็นการลบถาวรจาก Supabase Storage และนำรายการไฟล์ออกจากระบบ แต่ไม่ลบรายการงานหรือบันทึกการปฏิบัติงาน</div>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {message ? <div className="form-success" role="status">{message}</div> : null}
      <div className="storage-cleanup-actions">
        <button type="button" className="button button-secondary" disabled={pending !== null} onClick={() => cleanup("expired")}>{pending === "expired" ? "กำลังลบ…" : "ลบไฟล์เกิน 24 ชั่วโมง"}</button>
        <button type="button" className="button button-danger" disabled={pending !== null || documentCount + imageCount === 0} onClick={() => cleanup("all")}>{pending === "all" ? "กำลังล้างทั้งหมด…" : "ล้างไฟล์ทั้งหมด"}</button>
      </div>
    </div>
  </section>;
}
