import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireViewer } from "@/lib/auth/permissions";

export const metadata = { title: "ตั้งรหัสผ่านใหม่" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const viewer = await requireViewer({ allowPasswordChange: true });
  return <main className="auth-shell">
    <section className="auth-story"><div className="brand-mark">รง</div><div><h1>เริ่มต้นด้วยบัญชีที่ปลอดภัย</h1><p>รหัสผ่านใหม่จะใช้สำหรับการเข้าสู่ระบบครั้งต่อไป และไม่ถูกบันทึกไว้ในข้อมูลโปรไฟล์หรือ Audit log</p></div><div className="auth-note"><i /> บัญชี {viewer.username}</div></section>
    <section className="auth-panel"><div className="auth-card"><h2>ตั้งรหัสผ่านใหม่</h2><p>เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งานระบบ</p><ChangePasswordForm /><form action="/api/auth/logout" method="post" style={{ marginTop: 12 }}><button className="button button-secondary button-block">ออกจากระบบ</button></form></div></section>
  </main>;
}
