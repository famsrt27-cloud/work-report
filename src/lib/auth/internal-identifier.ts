import { z } from "zod";

export const usernameSchema = z.string().regex(/^\d{7}$/, "กรุณากรอกเลขประจำตัว 7 หลัก");

export function internalEmailForUsername(username: string) {
  const normalized = usernameSchema.parse(username);
  const domain = process.env.AUTH_INTERNAL_EMAIL_DOMAIN?.trim().toLowerCase();
  if (!domain || !/^(?=.{3,253}$)[a-z0-9.-]+\.[a-z]{2,63}$/.test(domain)) {
    throw new Error("AUTH_INTERNAL_EMAIL_DOMAIN is not configured with a valid controlled domain.");
  }
  return `${normalized}@${domain}`;
}
