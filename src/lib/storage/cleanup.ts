import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 500;
const MAX_BATCHES_PER_TABLE = 20;

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type StoredFileRow = { id: string; bucket: string; storage_key: string };
type CleanupTable = "source_documents" | "evidence_images";

export interface StorageCleanupResult {
  processed: number;
  deleted: number;
  failed: number;
  documentsDeleted: number;
  imagesDeleted: number;
}

async function listBatch(admin: AdminClient, table: CleanupTable, before?: string) {
  const selection = admin.from(table).select("id, bucket, storage_key").order("created_at").limit(BATCH_SIZE);
  const { data, error } = before ? await selection.lt("created_at", before) : await selection;
  if (error) throw error;
  return (data ?? []) as StoredFileRow[];
}

async function deleteMetadata(admin: AdminClient, table: CleanupTable, ids: string[]) {
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) throw error;
}

async function cleanupTable(admin: AdminClient, table: CleanupTable, before?: string) {
  let processed = 0;
  let deleted = 0;
  let failed = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch += 1) {
    const rows = await listBatch(admin, table, before);
    if (!rows.length) break;
    processed += rows.length;

    const byBucket = new Map<string, StoredFileRow[]>();
    for (const row of rows) byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);

    let batchFailed = false;
    for (const [bucket, bucketRows] of byBucket) {
      const { error } = await admin.storage.from(bucket).remove(bucketRows.map((row) => row.storage_key));
      if (error) {
        console.error("[storage-cleanup] remove failed", { table, bucket, code: error.name, message: error.message });
        failed += bucketRows.length;
        batchFailed = true;
        continue;
      }

      try {
        await deleteMetadata(admin, table, bucketRows.map((row) => row.id));
        deleted += bucketRows.length;
      } catch (error) {
        console.error("[storage-cleanup] metadata delete failed", {
          table,
          message: error instanceof Error ? error.message : "unknown",
        });
        failed += bucketRows.length;
        batchFailed = true;
      }
    }

    if (batchFailed || rows.length < BATCH_SIZE) break;
  }

  return { processed, deleted, failed };
}

export async function cleanupStoredFiles(options: { before?: Date; actorId?: string | null }) {
  const admin = createAdminSupabaseClient();
  const before = options.before?.toISOString();
  const { data: run } = await admin.from("file_cleanup_runs").insert({
    status: "running",
    processed: 0,
    deleted: 0,
    failed: 0,
  }).select("id").single();

  try {
    const [documents, images] = await Promise.all([
      cleanupTable(admin, "source_documents", before),
      cleanupTable(admin, "evidence_images", before),
    ]);
    const result: StorageCleanupResult = {
      processed: documents.processed + images.processed,
      deleted: documents.deleted + images.deleted,
      failed: documents.failed + images.failed,
      documentsDeleted: documents.deleted,
      imagesDeleted: images.deleted,
    };
    const status = result.failed === 0 ? "completed" : result.deleted > 0 ? "partial" : "failed";

    if (run) {
      await admin.from("file_cleanup_runs").update({
        completed_at: new Date().toISOString(),
        processed: result.processed,
        deleted: result.deleted,
        failed: result.failed,
        status,
      }).eq("id", run.id);
    }
    await admin.from("audit_events").insert({
      actor_id: options.actorId ?? null,
      entity_type: "storage_cleanup",
      action: before ? "expired_files_deleted" : "all_files_deleted",
      safe_diff_json: { ...result, before: before ?? null },
    });
    return result;
  } catch (error) {
    if (run) {
      await admin.from("file_cleanup_runs").update({
        completed_at: new Date().toISOString(),
        status: "failed",
        failed: 1,
      }).eq("id", run.id);
    }
    throw error;
  }
}
