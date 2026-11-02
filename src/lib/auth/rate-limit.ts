import "server-only";

import { createHmac } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const LIMIT = 5;
const WINDOW_MINUTES = 15;

function digest(value: string) {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER;
  if (!pepper || pepper.length < 32) throw new Error("AUTH_RATE_LIMIT_PEPPER must be at least 32 characters.");
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export async function loginRateLimitState(username: string, ip: string) {
  const admin = createAdminSupabaseClient();
  const accountHash = digest(username);
  const ipHash = digest(ip);
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await admin
    .from("auth_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("account_hash", accountHash)
    .eq("ip_hash", ipHash)
    .eq("successful", false)
    .gte("attempted_at", windowStart);
  if (error) throw error;
  return { blocked: (count ?? 0) >= LIMIT, accountHash, ipHash };
}

export async function recordLoginAttempt(accountHash: string, ipHash: string, successful: boolean) {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("auth_login_attempts").insert({ account_hash: accountHash, ip_hash: ipHash, successful });
  if (error) throw error;
}
