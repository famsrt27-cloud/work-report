import "server-only";

import { addPageNumbers, appendEvidencePages, appendPdfDocuments, createPdfWriter } from "@/lib/pdf/core";
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
  const writer = await createPdfWriter("รายงานผลการปฏิบัติงานรายเรื่อง", `${organizationName} • จัดทำเมื่อ ${formatThaiDate(new Date())}`);
  writer.section("ข้อมูลรายการงาน");
  writer.text(`${data.task.task_code}  ${data.task.title}`, { size: 14, bold: true, gapAfter: 10 });
  writer.infoGrid([
    { label: "ผู้รับผิดชอบ", value: data.owner.full_name },
    { label: "ตำแหน่ง", value: data.owner.position || "ไม่ระบุ" },
    { label: "ฝ่าย/หน่วยงาน", value: data.owner.departmentName || "ไม่ระบุ" },
    { label: "สถานะ", value: statusLabel[data.task.task_status] },
    { label: "วันที่ได้รับงาน", value: data.task.received_date ? formatThaiDate(data.task.received_date) : "ไม่ระบุ" },
    { label: "กำหนดส่ง", value: data.task.due_date ? formatThaiDate(data.task.due_date) : "ไม่ระบุ" },
  ]);
  if (data.task.description) {
    writer.section("รายละเอียดงานและวัตถุประสงค์");
    writer.text(data.task.description, { gapAfter: 8 });
  }
  const sourceLines = [
    data.source?.originating_unit && `หน่วยงานต้นเรื่อง: ${data.source.originating_unit}`,
    data.source?.assigner_name && `ผู้มอบหมาย: ${data.source.assigner_name}`,
    data.source?.reference_no && `เลขที่หนังสือ: ${data.source.reference_no}`,
    data.source?.reference_date && `วันที่หนังสือ: ${formatThaiDate(data.source.reference_date)}`,
  ].filter(Boolean) as string[];
  if (sourceLines.length) {
    writer.section("ที่มาของงาน");
    sourceLines.forEach((line) => writer.text(`• ${line}`, { indent: 4 }));
  }

  writer.section("บันทึกการปฏิบัติงาน");
  if (!data.logs.length) writer.text("ยังไม่มีบันทึกการปฏิบัติงาน");
  data.logs.forEach((log, index) => {
    writer.text(`${index + 1}. วันที่ ${formatThaiDate(log.work_date)}`, { bold: true, gapAfter: 1 });
    writer.text(`การปฏิบัติงาน: ${log.activity_detail}`, { indent: 16, gapAfter: 1 });
    writer.text(`ผลการปฏิบัติงาน: ${log.result_text}${log.duration_minutes ? `  (ระยะเวลา ${log.duration_minutes} นาที)` : ""}`, { indent: 16, gapAfter: 9 });
  });

  if (data.images.length) await appendEvidencePages(writer, data.images);
  await appendPdfDocuments(writer.document, data.sourcePdfs);
  addPageNumbers(writer.document, writer.font, organizationName);
  return writer.document.save();
}
