import { z } from "zod";

const optionalDate = z.union([z.iso.date(), z.literal("")]).optional();
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const taskSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่องาน").max(200),
  description: optionalText(5000),
  categoryId: z.string().uuid().nullable().optional(),
  receivedDate: optionalDate,
  dueDate: optionalDate,
  taskStatus: z.enum(["in_progress", "completed", "cancelled"]).default("in_progress"),
  sourceType: z.enum(["document", "person", "routine", "other"]).nullable().optional(),
  originatingUnit: optionalText(300),
  assignerName: optionalText(300),
  assignerPosition: optionalText(300),
  referenceNo: optionalText(200),
  referenceDate: optionalDate,
  sourceNote: optionalText(2000),
});

export const workLogSchema = z.object({
  workDate: z.iso.date(),
  activityDetail: z.string().trim().min(1, "กรุณาระบุรายละเอียดการปฏิบัติงาน").max(10000),
  resultText: z.string().trim().min(1, "กรุณาระบุผลการปฏิบัติงาน").max(10000),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  quantity: z.coerce.number().nonnegative().optional(),
  unit: optionalText(100),
});

export function durationBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return duration >= 0 ? duration : null;
}
