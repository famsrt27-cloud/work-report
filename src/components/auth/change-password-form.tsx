"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: form.get("newPassword"), confirmPassword: form.get("confirmPassword") }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ"); setPending(false); return; }
    router.replace(result.redirectTo); router.refresh();
  }
  return <form onSubmit={submit}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className="field"><label htmlFor="newPassword">รหัสผ่านใหม่</label><input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required /><small>อย่างน้อย 12 ตัวอักษร และใช้ตัวอักษร ตัวเลข หรือสัญลักษณ์อย่างน้อย 3 ประเภท</small></div>
    <div className="field"><label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></div>
    <button className="button button-primary button-block" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
  </form>;
}
