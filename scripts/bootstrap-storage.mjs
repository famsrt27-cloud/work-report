import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before bootstrapping storage.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const buckets = [
  {
    id: "work-source-docs",
    options: { public: false, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: ["application/pdf"] },
  },
  {
    id: "work-evidence",
    options: {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  },
  {
    id: "work-temporary",
    options: { public: false, fileSizeLimit: 20 * 1024 * 1024 },
  },
];

for (const bucket of buckets) {
  const { data: existing } = await supabase.storage.getBucket(bucket.id);
  const result = existing
    ? await supabase.storage.updateBucket(bucket.id, bucket.options)
    : await supabase.storage.createBucket(bucket.id, bucket.options);

  if (result.error) throw result.error;
  process.stdout.write(`Configured private bucket: ${bucket.id}\n`);
}
