import "server-only";

import { redirect } from "next/navigation";
import { hasPublicSupabaseEnv } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole, ViewerProfile } from "@/types";

export async function getViewer(): Promise<ViewerProfile | null> {
  if (!hasPublicSupabaseEnv) return null;
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) return null;

  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("user_id, username, full_name, position, department_id, must_change_password, is_active").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileResult.error || !profileResult.data) return null;

  return {
    ...profileResult.data,
    roles: (rolesResult.data ?? []).map((item) => item.role as AppRole),
  };
}

export async function requireViewer(options?: { allowPasswordChange?: boolean; roles?: AppRole[] }) {
  const viewer = await getViewer();
  if (!viewer || !viewer.is_active) redirect("/login");
  if (viewer.must_change_password && !options?.allowPasswordChange) redirect("/change-password");
  if (options?.roles && !options.roles.some((role) => viewer.roles.includes(role))) redirect("/dashboard");
  return viewer;
}
