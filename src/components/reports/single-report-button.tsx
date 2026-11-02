"use client";

import { useState } from "react";

export function SingleReportButton({ taskId, taskCode }: { taskId: string; taskCode: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setPending(true); setError("");
    const response = await fetch("/api/reports/single/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId }) });
    if (!response.ok) { const result = await response.json(); setError(result.error ?? "สร้าง PDF ไม่สำเร็จ"); setPending(false); return; }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${taskCode}.pdf`; anchor.click(); URL.revokeObjectURL(url); setPending(false);
  }
  return <div><button className="button button-secondary" onClick={download} disabled={pending}>{pending ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF รายเรื่อง"}</button>{error ? <div className="form-error" role="alert" style={{ marginTop: 8 }}>{error}</div> : null}</div>;
}
