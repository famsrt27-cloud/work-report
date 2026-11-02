export function SetupNotice() {
  return <main className="setup">
    <div className="brand-mark" style={{ background: "#102238" }}>รง</div>
    <h1>พร้อมเชื่อมต่อ Supabase</h1>
    <p>โครงแอปสร้างเสร็จแล้ว แต่ยังไม่พบ environment variables สำหรับโปรเจกต์ Supabase</p>
    <code>NEXT_PUBLIC_SUPABASE_URL</code>
    <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
    <code>SUPABASE_SERVICE_ROLE_KEY</code>
    <p>คัดลอก <strong>.env.example</strong> เป็น <strong>.env.local</strong> แล้วรัน migration ก่อนเริ่มใช้งาน</p>
  </main>;
}
