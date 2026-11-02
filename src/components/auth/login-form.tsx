"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      setPending(false);
      return;
    }
    router.replace(result.redirectTo);
    router.refresh();
  }

  return <form onSubmit={submit} noValidate>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className="field">
      <label htmlFor="username">เลขประจำตัวเจ้าหน้าที่</label>
      <input id="username" name="username" type="text" inputMode="numeric" autoComplete="username" maxLength={7} pattern="[0-9]{7}" placeholder="เลข 7 หลัก" required />
      <small>กรอกตัวเลขให้ครบ 7 หลัก รวมเลขศูนย์ด้านหน้า</small>
    </div>
    <div className="field">
      <label htmlFor="password">รหัสผ่าน</label>
      <div className="password-wrap">
        <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
        <button className="text-button" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "ซ่อน" : "แสดง"}</button>
      </div>
    </div>
    <button className="button button-primary button-block" disabled={pending}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
  </form>;
}
