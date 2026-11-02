import { NextResponse } from "next/server";
import { internalEmailForUsername } from "@/lib/auth/internal-identifier";
import { clientIp, loginRateLimitState, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

const INVALID_MESSAGE = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: INVALID_MESSAGE }, { status: 401 });

  try {
    const rateLimit = await loginRateLimitState(parsed.data.username, clientIp(request));
    if (rateLimit.blocked) {
      return NextResponse.json({ error: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที" }, { status: 429 });
    }

    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: internalEmailForUsername(parsed.data.username),
      password: parsed.data.password,
    });

    if (signInError) {
      await recordLoginAttempt(rateLimit.accountHash, rateLimit.ipHash, false);
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, must_change_password")
      .eq("username", parsed.data.username)
      .single();
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      await recordLoginAttempt(rateLimit.accountHash, rateLimit.ipHash, false);
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 401 });
    }

    await recordLoginAttempt(rateLimit.accountHash, rateLimit.ipHash, true);
    return NextResponse.json({ redirectTo: profile.must_change_password ? "/change-password" : "/dashboard" });
  } catch (error) {
    console.error("Login configuration failure", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล" }, { status: 503 });
  }
}
