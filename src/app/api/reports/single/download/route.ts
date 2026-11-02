import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiViewer } from "@/lib/auth/api";
import { generateSingleReport } from "@/lib/pdf/generate-single";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  taskId: z.string().uuid(),
  evidenceIds: z.array(z.string().uuid()).max(100).optional(),
  sourceDocumentIds: z.array(z.string().uuid()).max(20).optional(),
});

async function downloadObjects(admin: ReturnType<typeof createAdminSupabaseClient>, rows: Array<{ bucket: string; storage_key: string; original_name?: string; mime?: string; caption?: string | null }>) {
  return Promise.all(rows.map(async (row) => {
    const { data, error } = await admin.storage.from(row.bucket).download(row.storage_key);
    if (error || !data) throw new Error(`อ่านไฟล์ ${row.original_name ?? row.storage_key} ไม่สำเร็จ`);
    return { ...row, bytes: new Uint8Array(await data.arrayBuffer()) };
  }));
}

export async function POST(request: Request) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ตัวเลือกรายงานไม่ถูกต้อง" }, { status: 400 });
  const { taskId, evidenceIds, sourceDocumentIds } = parsed.data;
  const { data: task, error } = await context.supabase.from("tasks").select("id, task_code, title, description, task_status, received_date, due_date, owner_user_id").eq("id", taskId).single();
  if (error || !task) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์" }, { status: 404 });
  const [ownerResult, taskSourceResult, logsResult] = await Promise.all([
    context.supabase.from("profiles").select("full_name, position, department_id").eq("user_id", task.owner_user_id).single(),
    context.supabase.from("task_sources").select("originating_unit, assigner_name, reference_no, reference_date").eq("task_id", taskId).maybeSingle(),
    context.supabase.from("work_logs").select("id, work_date, activity_detail, result_text, duration_minutes").eq("task_id", taskId).order("work_date"),
  ]);
  const owner = ownerResult.data;
  const logs = logsResult.data ?? [];
  const { data: department } = owner?.department_id
    ? await context.supabase.from("departments").select("name").eq("id", owner.department_id).single()
    : { data: null };
  const logIds = logs.map((log) => log.id);
  let evidenceQuery = context.supabase.from("evidence_images").select("id, bucket, storage_key, original_name, mime, caption, include_in_pdf").in("work_log_id", logIds.length ? logIds : ["00000000-0000-0000-0000-000000000000"]);
  evidenceQuery = evidenceIds ? evidenceQuery.in("id", evidenceIds) : evidenceQuery.eq("include_in_pdf", true);
  let sourceQuery = context.supabase.from("source_documents").select("id, bucket, storage_key, original_name").eq("task_id", taskId);
  if (sourceDocumentIds) sourceQuery = sourceQuery.in("id", sourceDocumentIds);
  const [evidenceResult, sourceResult] = await Promise.all([evidenceQuery, sourceQuery]);
  if (evidenceIds && (evidenceResult.data?.length ?? 0) !== evidenceIds.length) return NextResponse.json({ error: "มีรูปหลักฐานที่ไม่อยู่ในงานนี้หรือไม่มีสิทธิ์" }, { status: 403 });
  if (sourceDocumentIds && (sourceResult.data?.length ?? 0) !== sourceDocumentIds.length) return NextResponse.json({ error: "มีเอกสารต้นเรื่องที่ไม่อยู่ในงานนี้หรือไม่มีสิทธิ์" }, { status: 403 });

  try {
    const admin = createAdminSupabaseClient();
    const [images, sourcePdfs] = await Promise.all([
      downloadObjects(admin, evidenceResult.data ?? []),
      downloadObjects(admin, sourceResult.data ?? []),
    ]);
    const bytes = await generateSingleReport({
      task,
      owner: {
        full_name: owner?.full_name ?? "ไม่ระบุ",
        position: owner?.position ?? null,
        departmentName: department?.name ?? null,
      },
      source: taskSourceResult.data,
      logs,
      images: images.map((image) => ({ bytes: image.bytes, mime: image.mime ?? "", caption: image.caption })),
      sourcePdfs: sourcePdfs.map((file) => ({ name: file.original_name ?? "source.pdf", bytes: file.bytes })),
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${task.task_code}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (reportError) {
    return NextResponse.json({ error: reportError instanceof Error ? reportError.message : "สร้าง PDF ไม่สำเร็จ" }, { status: 500 });
  }
}
