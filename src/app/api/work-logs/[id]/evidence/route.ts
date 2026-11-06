import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/storage/buckets";
import { inspectUpload, safeOriginalName } from "@/lib/storage/files";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const { id: workLogId } = await params;
  const { data: workLog } = await context.supabase.from("work_logs").select("id, task_id").eq("id", workLogId).single();
  if (!workLog) return NextResponse.json({ error: "ไม่พบบันทึกงานหรือไม่มีสิทธิ์" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  const { count } = await context.supabase.from("evidence_images").select("id", { count: "exact", head: true }).eq("work_log_id", workLogId);
  if (!files.length) return NextResponse.json({ error: "กรุณาเลือกรูปภาพ" }, { status: 400 });
  if ((count ?? 0) + files.length > 15) return NextResponse.json({ error: "บันทึกงานหนึ่งรายการมีรูปหลักฐานได้ไม่เกิน 15 รูป" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const created: Array<{ id: string; original_name: string }> = [];
  try {
    await ensureStorageBucket(admin, "work-evidence");
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const inspected = await inspectUpload(file, "image");
      const storageKey = `${workLog.task_id}/${workLogId}/${inspected.objectName}`;
      const { error: uploadError } = await admin.storage.from("work-evidence").upload(storageKey, inspected.bytes, {
        contentType: inspected.mime,
        cacheControl: "private, max-age=0, no-store",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: row, error: rowError } = await admin.from("evidence_images").insert({
        work_log_id: workLogId,
        bucket: "work-evidence",
        storage_key: storageKey,
        original_name: safeOriginalName(file.name),
        mime: inspected.mime,
        size_bytes: inspected.size,
        display_order: (count ?? 0) + index,
        include_in_pdf: true,
        sha256: inspected.sha256,
        uploaded_by: context.userId,
      }).select("id, original_name").single();
      if (rowError || !row) {
        await admin.storage.from("work-evidence").remove([storageKey]);
        throw rowError ?? new Error("metadata insert failed");
      }
      created.push(row);
    }
    return NextResponse.json({ files: created }, { status: 201 });
  } catch (error) {
    console.error("Evidence upload failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "อัปโหลดรูปหลักฐานไม่สำเร็จ ไฟล์ที่ไม่สมบูรณ์ถูกยกเลิกแล้ว" }, { status: 400 });
  }
}
