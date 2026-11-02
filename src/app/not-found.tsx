import Link from "next/link";
export default function NotFoundPage() { return <main className="setup"><h1>ไม่พบหน้าที่ต้องการ</h1><p>รายการอาจไม่มีอยู่ หรือบัญชีของท่านไม่มีสิทธิ์เข้าถึง</p><Link className="button button-primary" href="/dashboard">กลับ Dashboard</Link></main>; }
