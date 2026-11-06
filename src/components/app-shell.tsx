import Link from "next/link";
import { canAccessIndividualDashboard } from "@/lib/auth/roles";
import type { ViewerProfile } from "@/types";

export function AppShell({ viewer, children }: { viewer: ViewerProfile; children: React.ReactNode }) {
  const isAdmin = viewer.roles.includes("admin");
  const canViewIndividualDashboard = canAccessIndividualDashboard(viewer.roles);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-brand"><div className="brand-mark">รง</div><div className="brand-copy"><strong>Work Report</strong><span>ระบบรายงานการปฏิบัติงาน</span></div></Link>
      <nav className="nav" aria-label="เมนูหลัก">
        <div className="nav-section">ภาพรวม</div>
        <Link href="/dashboard">Dashboard</Link>
        {canViewIndividualDashboard ? <Link href="/dashboard/individual">Dashboard รายบุคคล</Link> : null}
        <div className="nav-section">การปฏิบัติงาน</div>
        <Link href="/tasks">รายการงาน</Link>
        <Link href="/tasks/new">เพิ่มงานใหม่</Link>
        <Link href="/notifications">การแจ้งเตือน</Link>
        {isAdmin ? <><div className="nav-section">ผู้ดูแลระบบ</div><Link href="/settings/users">จัดการผู้ใช้งาน</Link></> : null}
      </nav>
      <div className="sidebar-user"><strong>{viewer.full_name}</strong><span>{viewer.position || viewer.username}</span><form action="/api/auth/logout" method="post"><button className="text-button">ออกจากระบบ</button></form></div>
    </aside>
    <div className="main"><header className="topbar"><div className="mobile-brand">ระบบรายงานงาน</div><div className="topbar-context">ข้อมูลตามสิทธิ์ของหน่วยงาน</div><div className="topbar-actions"><Link className="button button-secondary" href="/notifications" aria-label="เปิดการแจ้งเตือน">การแจ้งเตือน</Link></div></header>{children}</div>
  </div>;
}
