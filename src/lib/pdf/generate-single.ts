import "server-only";

import { addPageNumbers, appendImagePage, appendPdfDocuments, createPdfWriter } from "@/lib/pdf/core";
import { formatThaiDate, statusLabel } from "@/lib/format";
import { organizationName } from "@/lib/config";

export interface SingleReportData {
  task: {
    task_code: string; title: string; description: string | null; task_status: keyof typeof statusLabel;
    received_date: string | null; due_date: string | null;
  };
  owner: { full_name: string; position: string | null; departmentName?: string | null };
  source?: { originating_unit?: string | null; assigner_name?: string | null; reference_no?: string | null; reference_date?: string | null } | null;
  logs: Array<{ work_date: string; activity_detail: string; result_text: string; duration_minutes: number | null }>;
  images: Array<{ bytes: Uint8Array; mime: string; caption?: string | null }>;
  sourcePdfs: Array<{ name: string; bytes: Uint8Array }>;
}

export async function generateSingleReport(data: SingleReportData) {
  const writer = await createPdfWriter("รายงานผลการปฏิบัติงานรายเรื่อง", `${organizationName} • สร้างเมื่อ ${formatThaiDate(new Date())}`);
  writer.section(`${data.task.task_code}  ${data.task.title}`);
  writer.text(`ผู้รับผิดชอบ: ${data.owner.full_name}${data.owner.position ? `  ตำแหน่ง ${data.owner.position}` : ""}`);
  if (data.owner.departmentName) writer.text(`ฝ่าย/หน่วยงาน: ${data.owner.departmentName}`);
  writer.text(`สถานะ: ${statusLabel[data.task.task_status]}`);
  if (data.task.received_date) writer.text(`วันที่ได้รับงาน: ${formatThaiDate(data.task.received_date)}`);
  if (data.task.due_date) writer.text(`กำหนดส่ง: ${formatThaiDate(data.task.due_date)}`);
  if (data.task.description) {
    writer.section("รายละเอียดงานและวัตถุประสงค์");
    writer.text(data.task.description);
  }
  const sourceLines = [
    data.source?.originating_unit && `หน่วยงานต้นเรื่อง: ${data.source.originating_unit}`,
    data.source?.assigner_name && `ผู้มอบหมาย: ${data.source.assigner_name}`,
    data.source?.reference_no && `เลขที่หนังสือ: ${data.source.reference_no}`,
    data.source?.reference_date && `วันที่หนังสือ: ${formatThaiDate(data.source.reference_date)}`,
  ].filter(Boolean) as string[];
  if (sourceLines.length) {
    writer.section("ที่มาของงาน");
    sourceLines.forEach((line) => writer.text(line));
  }

  writer.section("บันทึกการปฏิบัติงาน");
  if (!data.logs.length) writer.text("ยังไม่มีบันทึกการปฏิบัติงาน");
  data.logs.forEach((log, index) => {
    writer.text(`${index + 1}. ${formatThaiDate(log.work_date)} — ${log.activity_detail}`, { bold: true });
    writer.text(`ผลการปฏิบัติงาน: ${log.result_text}${log.duration_minutes ? ` (${log.duration_minutes} นาที)` : ""}`, { gapAfter: 8 });
  });

  if (data.images.length) {
    writer.section("ภาคผนวกภาพหลักฐาน");
    for (const image of data.images) await appendImagePage(writer, image.bytes, image.mime, image.caption);
  }
  await appendPdfDocuments(writer.document, data.sourcePdfs);
  addPageNumbers(writer.document, writer.font);
  return writer.document.save();
}
