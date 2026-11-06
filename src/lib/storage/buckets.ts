import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const bucketOptions = {
  "work-source-docs": {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  },
  "work-evidence": {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
} satisfies Record<string, {
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}>;

export type ManagedStorageBucket = keyof typeof bucketOptions;

export async function ensureStorageBucket(
  admin: SupabaseClient<Database>,
  bucket: ManagedStorageBucket,
) {
  const { data: existing } = await admin.storage.getBucket(bucket);
  if (existing) return;

  const { error: createError } = await admin.storage.createBucket(bucket, bucketOptions[bucket]);
  if (!createError) return;

  // Another request may have created the bucket after the first lookup.
  const { data: createdByAnotherRequest } = await admin.storage.getBucket(bucket);
  if (!createdByAnotherRequest) throw createError;
}
