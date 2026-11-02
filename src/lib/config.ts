export const hasPublicSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const hasAdminSupabaseEnv = Boolean(
  hasPublicSupabaseEnv && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are not configured.");
  return { url, key };
}

export const organizationName = process.env.NEXT_PUBLIC_ORGANIZATION_NAME || "ระบบรายงานการปฏิบัติงาน";
