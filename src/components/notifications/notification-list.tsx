"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NotificationItem { id: number; title: string; body: string; created_at: string; read_at: string | null }

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
  async function markRead() {
    if (!unreadIds.length) return;
    setPending(true);
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: unreadIds }) });
    setPending(false); router.refresh();
  }
  return <section className="panel"><div className="panel-head"><h2>ล่าสุด</h2><button className="text-button" onClick={markRead} disabled={pending || !unreadIds.length}>{pending ? "กำลังบันทึก…" : "อ่านทั้งหมดแล้ว"}</button></div>{items.length ? <div>{items.map((item) => <article key={item.id} style={{ padding: "18px 20px", borderBottom: "1px solid #edf1f4", background: item.read_at ? "white" : "#f4f8fb" }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}>{!item.read_at ? <span style={{ width: 8, height: 8, borderRadius: 8, background: "#e9a62e" }} /> : null}<strong>{item.title}</strong></div><p style={{ color: "#607184", margin: "7px 0", lineHeight: 1.6 }}>{item.body}</p><small style={{ color: "#8090a0" }}>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</small></article>)}</div> : <div className="empty"><strong>ไม่มีการแจ้งเตือน</strong>เมื่อมีงานใหม่หรือรายงานส่งกลับ รายการจะแสดงที่นี่</div>}</section>;
}
