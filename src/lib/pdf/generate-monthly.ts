import "server-only";

import { addPageNumbers, createPdfWriter } from "@/lib/pdf/core";
import { formatDuration, formatThaiDate, formatThaiMonth, statusLabel } from "@/lib/format";
import { organizationName } from "@/lib/config";
import type { DashboardMetrics, TaskStatus } from "@/types";

export interface MonthlyReportData {
  month: string;
  profile: { full_name: string; position: string | null; departmentName?: string | null };
  metrics: DashboardMetrics;
  tasks: Array<{ task_code: string; title: string; task_status: TaskStatus; latestResult?: string | null; workDate?: string | null }>;
}

export async function generateMonthlyReport(data: MonthlyReportData) {
  const writer = await createPdfWriter("รายงานผลการปฏิบัติงานประจำเดือน", `${organizationName} • ${formatThaiMonth(data.month)}`);
  writer.section("ข้อมูลผู้จัดทำรายงาน");
  writer.infoGrid([
    { label: "ชื่อ-นามสกุล", value: data.profile.full_name },
    { label: "ตำแหน่ง", value: data.profile.position || "ไม่ระบุ" },
    { label: "ฝ่าย/หน่วยงาน", value: data.profile.departmentName || "ไม่ระบุ" },
    { label: "เดือนที่รายงาน", value: formatThaiMonth(data.month) },
  ]);
  writer.section("สรุปผลการปฏิบัติงาน");
  writer.metricGrid([
    { label: "งานทั้งหมด", value: `${data.metrics.uniqueTasks} งาน` },
    { label: "บันทึกการปฏิบัติงาน", value: `${data.metrics.workLogs} ครั้ง` },
    { label: "เสร็จสิ้น", value: `${data.metrics.completed} งาน` },
    { label: "กำลังดำเนินการ", value: `${data.metrics.inProgress} งาน` },
    { label: "เกินกำหนด", value: `${data.metrics.overdue} งาน` },
    { label: "เวลาที่บันทึก", value: formatDuration(data.metrics.durationMinutes) },
  ]);
  writer.section("รายการงานในเดือน");
  if (!data.tasks.length) writer.text("ไม่มีรายการงานในเดือนที่เลือก");
  data.tasks.forEach((task, index) => {
    writer.text(`${index + 1}. ${task.task_code}  ${task.title}`, { bold: true });
    writer.text(`${task.workDate ? `วันที่บันทึกล่าสุด ${formatThaiDate(task.workDate)}  •  ` : ""}สถานะ ${statusLabel[task.task_status]}`, { indent: 16 });
    if (task.latestResult) writer.text(`ผลการปฏิบัติงานล่าสุด: ${task.latestResult}`, { indent: 16, gapAfter: 9 });
  });
  addPageNumbers(writer.document, writer.font, organizationName);
  return writer.document.save();
}
