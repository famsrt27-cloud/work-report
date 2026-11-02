"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDuration, statusLabel } from "@/lib/format";
import type { DashboardMetrics, TaskStatus } from "@/types";

interface Employee { user_id: string; full_name: string; position: string | null }
interface DashboardData {
  metrics: DashboardMetrics;
  categories: Array<{ name: string; count: number }>;
  tasks: Array<{ id: string; task_code: string; title: string; statusAtPeriodEnd: TaskStatus; due_date: string | null }>;
}

export function IndividualDashboard({ employees, initialUserId, initialMonth }: { employees: Employee[]; initialUserId: string; initialMonth: string }) {
  const [userId, setUserId] = useState(initialUserId);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/dashboard/individual?user_id=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}`, { signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then((result) => setData(result))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "โหลดข้อมูลไม่สำเร็จ"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, month]);

  const maxCategory = useMemo(() => Math.max(1, ...(data?.categories.map((item) => item.count) ?? [1])), [data]);

  async function downloadMonthly() {
    setError("");
    const response = await fetch("/api/reports/monthly/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, month }) });
    if (!response.ok) { const result = await response.json(); setError(result.error ?? "สร้าง PDF ไม่สำเร็จ"); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `monthly-${month}.pdf`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <div className="filters">
      <div className="field" style={{ margin: 0 }}><label htmlFor="employee">เจ้าหน้าที่</label><select id="employee" className="filter-control" value={userId} onChange={(event) => setUserId(event.target.value)}>{employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.full_name}{employee.position ? ` — ${employee.position}` : ""}</option>)}</select></div>
      <div className="field" style={{ margin: 0 }}><label htmlFor="month">เดือน</label><input id="month" className="filter-control" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
      <button className="button button-primary" onClick={downloadMonthly} disabled={loading || !data}>ดาวน์โหลด PDF รายเดือน</button>
    </div>
    <div className="notice" style={{ marginBottom: 18 }}>ระบบสร้าง PDF ใหม่ทุกครั้งที่ดาวน์โหลด โดยไม่เก็บไฟล์รายงานที่สร้างไว้ในระบบ</div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {loading ? <div className="panel"><div className="empty">กำลังคำนวณข้อมูล…</div></div> : data ? <>
      <section className="metric-grid">
        <div className="metric"><span>งานไม่ซ้ำ</span><strong>{data.metrics.uniqueTasks}</strong><small>จากบันทึกในเดือน</small></div>
        <div className="metric"><span>บันทึกการปฏิบัติงาน</span><strong>{data.metrics.workLogs}</strong><small>ครั้ง</small></div>
        <div className="metric"><span>งานเสร็จสิ้น</span><strong>{data.metrics.completed}</strong><small>ณ วันสิ้นรอบ</small></div>
        <div className={`metric ${data.metrics.overdue ? "is-warn" : ""}`}><span>เวลาที่บันทึก</span><strong style={{ fontSize: 24 }}>{formatDuration(data.metrics.durationMinutes)}</strong><small>เกินกำหนด {data.metrics.overdue} งาน</small></div>
      </section>
      <section className="section-grid">
        <div className="panel"><div className="panel-head"><h2>รายการงานในเดือน</h2></div>{data.tasks.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>เลขที่งาน</th><th>ชื่องาน</th><th>สถานะสิ้นรอบ</th></tr></thead><tbody>{data.tasks.map((task) => <tr key={task.id}><td className="task-code">{task.task_code}</td><td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td><td>{statusLabel[task.statusAtPeriodEnd]}</td></tr>)}</tbody></table></div> : <div className="empty">ไม่มีบันทึกงานในเดือนที่เลือก</div>}</div>
        <div className="panel"><div className="panel-head"><h2>ประเภทงาน</h2></div><div className="panel-body"><div className="bar-list">{data.categories.length ? data.categories.map((item) => <div className="bar-row" key={item.name}><span>{item.name}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${(item.count / maxCategory) * 100}%` }} /></div><strong>{item.count}</strong></div>) : <div className="empty">ยังไม่มีข้อมูล</div>}</div></div></div>
      </section>
    </> : null}
  </>;
}
