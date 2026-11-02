import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/setup-notice";
import { hasPublicSupabaseEnv } from "@/lib/config";
import { getViewer } from "@/lib/auth/permissions";

export const metadata = { title: "เข้าสู่ระบบ" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!hasPublicSupabaseEnv) return <SetupNotice />;
  const viewer = await getViewer();
  if (viewer) redirect(viewer.must_change_password ? "/change-password" : "/dashboard");
  return <main className="auth-shell">
    <section className="auth-story">
      <div className="brand-mark">รง</div>
      <div>
        <h1>บันทึกครั้งเดียว<br />พร้อมรายงานทุกเมื่อ</h1>
        <p>รวมรายการงาน บันทึกการปฏิบัติงาน และหลักฐานไว้ในระบบเดียว เพื่อให้การติดตามงานและจัดทำรายงานเป็นเรื่องตรงไปตรงมา</p>
      </div>
      <div className="auth-note"><i /> ข้อมูลของท่านได้รับการคุ้มครองตามสิทธิ์ของหน่วยงาน</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <h2>ยินดีต้อนรับ</h2>
        <p>เข้าสู่ระบบด้วยเลขประจำตัวเจ้าหน้าที่และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</p>
        <LoginForm />
        <p style={{ marginTop: 22, fontSize: 13 }}>ยังไม่มีบัญชีหรือเข้าใช้งานไม่ได้ โปรดติดต่อผู้ดูแลระบบของหน่วยงาน</p>
      </div>
    </section>
  </main>;
}
