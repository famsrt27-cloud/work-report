import Link from "next/link";
import { requireViewer } from "@/lib/auth/permissions";
import { INDIVIDUAL_DASHBOARD_ROLES } from "@/lib/auth/roles";

export default async function MonthlyReportsPage() {
  await requireViewer({ roles: INDIVIDUAL_DASHBOARD_ROLES });
  return <main className="content"><div className="page-heading"><div><h1>รายงานประจำเดือน</h1><p>รายงานใช้ตัวกรองเจ้าหน้าที่และเดือนชุดเดียวกับ Dashboard</p></div></div><div className="panel empty"><strong>สร้างจาก Dashboard รายบุคคล</strong><Link className="button button-primary" href="/dashboard/individual" style={{ marginTop: 14 }}>ไปยัง Dashboard</Link></div></main>;
}
