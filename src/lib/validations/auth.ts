import { z } from "zod";
import { usernameSchema } from "@/lib/auth/internal-identifier";

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(12, "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร"),
  confirmPassword: z.string(),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });
  }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value.newPassword)).length;
  if (kinds < 3) {
    ctx.addIssue({ code: "custom", path: ["newPassword"], message: "ใช้ตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข หรือสัญลักษณ์อย่างน้อย 3 ประเภท" });
  }
});

export const createUserSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(1).max(200),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  departmentId: z.string().uuid().nullable().optional(),
  role: z.enum(["staff", "supervisor", "manager", "admin"]),
});

const departmentNameSchema = z.string()
  .trim()
  .min(1, "กรุณาระบุชื่อฝ่าย")
  .max(120, "ชื่อฝ่ายต้องไม่เกิน 120 ตัวอักษร");

export const createDepartmentSchema = z.object({
  name: departmentNameSchema,
});

export const updateDepartmentSchema = z.object({
  name: departmentNameSchema.optional(),
  active: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.active !== undefined, {
  message: "ไม่มีข้อมูลที่ต้องแก้ไข",
});
