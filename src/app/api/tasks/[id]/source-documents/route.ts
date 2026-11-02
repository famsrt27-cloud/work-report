import { NextResponse } from "next/server";
import { getApiViewer } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { inspectUpload, safeOriginalName } from "@/lib/storage/files";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getApiViewer();
  if (context.error) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 401 });
  const { id: taskId } = await params;
  const { data: task } = await context.supabase.from("tasks").select("id").eq("id", taskId).single();
  if (!task) return NextResponse.json({ error: "ไม่พบงานหรือไม่มีสิทธิ์" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return NextResponse.json({ error: "กรุณาเลือกไฟล์ PDF" }, { status: 400 });
  if (files.length > 10) return NextResponse.json({ error: "อัปโหลดได้ไม่เกิน 10 ไฟล์ต่อครั้ง" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const created: Array<{ id: string; original_name: string }> = [];
  try {
    for (const file of files) {
      const inspected = await inspectUpload(file, "pdf");
      const storageKey = `${taskId}/${inspected.objectName}`;
      const { error: uploadError } = await admin.storage.from("work-source-docs").upload(storageKey, inspected.bytes, {
        contentType: inspected.mime,
        cacheControl: "private, max-age=0, no-store",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: row, error: rowError } = await admin.from("source_documents").insert({
        task_id: taskId,
        bucket: "work-source-docs",
        storage_key: storageKey,
        original_name: safeOriginalName(file.name),
        mime: inspected.mime,
        size_bytes: inspected.size,
        sha256: inspected.sha256,
        uploaded_by: context.userId,
      }).select("id, original_name").single();
      if (rowError || !row) {
        await admin.storage.from("work-source-docs").remove([storageKey]);
        throw rowError ?? new Error("metadata insert failed");
      }
      created.push(row);
    }
    return NextResponse.json({ files: created }, { status: 201 });
  } catch (error) {
    console.error("Source document upload failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "อัปโหลดหนังสือต้นเรื่องไม่สำเร็จ ไฟล์ที่ไม่สมบูรณ์ถูกยกเลิกแล้ว" }, { status: 400 });
  }
}
