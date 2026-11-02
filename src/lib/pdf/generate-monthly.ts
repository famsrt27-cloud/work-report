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
  writer.section(data.profile.full_name);
  if (data.profile.position) writer.text(`ตำแหน่ง: ${data.profile.position}`);
  if (data.profile.departmentName) writer.text(`ฝ่าย/หน่วยงาน: ${data.profile.departmentName}`);
  writer.text(`สร้างรายงานเมื่อ: ${formatThaiDate(new Date())}`);
  writer.section("สรุปผลการปฏิบัติงาน");
  writer.text(`งานไม่ซ้ำ ${data.metrics.uniqueTasks} งาน • บันทึกการปฏิบัติงาน ${data.metrics.workLogs} ครั้ง`);
  writer.text(`เสร็จสิ้น ${data.metrics.completed} งาน • กำลังดำเนินการ ${data.metrics.inProgress} งาน • ยกเลิก ${data.metrics.cancelled} งาน`);
  writer.text(`เวลาปฏิบัติงานที่มีการบันทึก ${formatDuration(data.metrics.durationMinutes)} • เกินกำหนด ${data.metrics.overdue} งาน`);
  writer.section("รายการงานในเดือน");
  if (!data.tasks.length) writer.text("ไม่มีรายการงานในเดือนที่เลือก");
  data.tasks.forEach((task, index) => {
    writer.text(`${index + 1}. ${task.task_code}  ${task.title}`, { bold: true });
    writer.text(`${task.workDate ? `${formatThaiDate(task.workDate)} • ` : ""}${statusLabel[task.task_status]}`);
    if (task.latestResult) writer.text(`ผลการปฏิบัติงาน: ${task.latestResult}`, { gapAfter: 8 });
  });
  addPageNumbers(writer.document, writer.font);
  return writer.document.save();
}
