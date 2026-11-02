import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "@/lib/config";
import type { Database } from "@/types/database";

export function createAdminSupabaseClient() {
  const { url } = publicSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
