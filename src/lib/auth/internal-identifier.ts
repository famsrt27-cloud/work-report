import { z } from "zod";

export const usernameSchema = z.string().regex(/^\d{7}$/, "กรุณากรอกเลขประจำตัว 7 หลัก");

// Supabase password auth requires an email or phone identifier. Keep that
// implementation detail internal so users sign in with their 7-digit number only.
const INTERNAL_AUTH_EMAIL_DOMAIN = "work-report.invalid";

export function internalEmailForUsername(username: string) {
  const normalized = usernameSchema.parse(username);
  return `${normalized}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}
