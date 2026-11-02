import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types";

export async function getApiViewer(options?: { roles?: AppRole[]; allowPasswordChange?: boolean }) {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) return { error: "unauthorized" as const, supabase };

  const [profileResult, roleResult] = await Promise.all([
    supabase.from("profiles").select("user_id, username, full_name, department_id, must_change_password, is_active").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const profile = profileResult.data;
  const roles = (roleResult.data ?? []).map((item) => item.role as AppRole);
  if (!profile || !profile.is_active) return { error: "unauthorized" as const, supabase };
  if (profile.must_change_password && !options?.allowPasswordChange) return { error: "password_change_required" as const, supabase };
  if (options?.roles && !options.roles.some((role) => roles.includes(role))) return { error: "forbidden" as const, supabase };

  return { error: null, supabase, profile, roles, userId };
}
