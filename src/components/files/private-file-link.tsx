"use client";

import { useState } from "react";

export function PrivateFileLink({ kind, id, children }: { kind: "source" | "evidence"; id: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  async function open() {
    setPending(true);
    const response = await fetch(`/api/files/${kind}/${id}`);
    const result = await response.json();
    setPending(false);
    if (!response.ok) { window.alert(result.error ?? "เปิดไฟล์ไม่สำเร็จ"); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }
  return <button className="text-button" type="button" onClick={open} disabled={pending}>{pending ? "กำลังเปิด…" : children}</button>;
}
