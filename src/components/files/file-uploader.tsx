"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FileUploader({ endpoint, accept, label, multiple = true }: { endpoint: string; accept: string; label: string; multiple?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setProgress(0); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await new Promise<{ ok: boolean; body: { error?: string; files?: unknown[] } }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.upload.addEventListener("progress", (progressEvent) => {
        if (progressEvent.lengthComputable) setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      });
      xhr.addEventListener("load", () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch { body = { error: "คำตอบจากระบบไม่ถูกต้อง" }; }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, body });
      });
      xhr.addEventListener("error", () => resolve({ ok: false, body: { error: "เชื่อมต่อระบบอัปโหลดไม่สำเร็จ" } }));
      xhr.send(form);
    });
    if (!result.ok) { setError(result.body.error ?? "อัปโหลดไม่สำเร็จ"); setPending(false); return; }
    setMessage(`อัปโหลดสำเร็จ ${result.body.files?.length ?? 0} ไฟล์`); setPending(false); setProgress(100); formElement.reset(); router.refresh();
  }
  return <form onSubmit={submit}>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {message ? <div className="form-success" role="status">{message}</div> : null}
    <div className="field"><label htmlFor={`files-${endpoint}`}>{label}</label><input id={`files-${endpoint}`} name="files" type="file" accept={accept} multiple={multiple} required /></div>
    {pending ? <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 7, background: "#e8eef3", borderRadius: 9, marginBottom: 10, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, background: "#22547d" }} /></div> : null}
    <button className="button button-secondary" disabled={pending}>{pending ? `กำลังอัปโหลด ${progress}%` : "อัปโหลดไฟล์"}</button>
  </form>;
}
