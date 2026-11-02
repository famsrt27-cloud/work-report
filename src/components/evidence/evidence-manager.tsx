"use client";

import { useState } from "react";
import { PrivateFileLink } from "@/components/files/private-file-link";

interface EvidenceItem {
  id: string;
  original_name: string;
  caption: string | null;
  display_order: number;
  include_in_pdf: boolean;
}

export function EvidenceManager({ items }: { items: EvidenceItem[] }) {
  const [evidence, setEvidence] = useState(() => items.toSorted((a, b) => a.display_order - b.display_order));
  const [error, setError] = useState("");

  async function patch(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/evidence/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? "บันทึกการตั้งค่ารูปไม่สำเร็จ");
    }
  }

  async function toggle(item: EvidenceItem) {
    setError("");
    const next = !item.include_in_pdf;
    try {
      await patch(item.id, { includeInPdf: next });
      setEvidence((current) => current.map((entry) => entry.id === item.id ? { ...entry, include_in_pdf: next } : entry));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }

  async function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= evidence.length) return;
    setError("");
    const current = evidence[index];
    const target = evidence[targetIndex];
    try {
      await Promise.all([
        patch(current.id, { displayOrder: target.display_order }),
        patch(target.id, { displayOrder: current.display_order }),
      ]);
      setEvidence((itemsNow) => {
        const copy = [...itemsNow];
        copy[index] = { ...target, display_order: current.display_order };
        copy[targetIndex] = { ...current, display_order: target.display_order };
        return copy;
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "จัดเรียงไม่สำเร็จ"); }
  }

  async function saveCaption(item: EvidenceItem, caption: string) {
    if ((item.caption ?? "") === caption.trim()) return;
    try {
      await patch(item.id, { caption: caption.trim() || null });
      setEvidence((current) => current.map((entry) => entry.id === item.id ? { ...entry, caption: caption.trim() || null } : entry));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกคำบรรยายไม่สำเร็จ"); }
  }

  return <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {evidence.map((item, index) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px, .7fr) minmax(160px, 1fr) auto", gap: 10, alignItems: "center", padding: 10, border: "1px solid #dbe3ea", borderRadius: 9 }}>
      <PrivateFileLink kind="evidence" id={item.id}>{item.original_name}</PrivateFileLink>
      <input aria-label={`คำบรรยาย ${item.original_name}`} defaultValue={item.caption ?? ""} placeholder="คำบรรยายภาพ" onBlur={(event) => saveCaption(item, event.target.value)} style={{ width: "100%", minHeight: 38, border: "1px solid #cbd7e1", borderRadius: 8, padding: "7px 9px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <label className="check-row" style={{ marginRight: 6 }}><input type="checkbox" checked={item.include_in_pdf} onChange={() => toggle(item)} /> PDF</label>
        <button className="button button-secondary" type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="เลื่อนรูปขึ้น">↑</button>
        <button className="button button-secondary" type="button" onClick={() => move(index, 1)} disabled={index === evidence.length - 1} aria-label="เลื่อนรูปลง">↓</button>
      </div>
    </div>)}
  </div>;
}
