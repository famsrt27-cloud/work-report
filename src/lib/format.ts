const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });
const thaiMonth = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

export function formatThaiDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return thaiDate.format(typeof value === "string" ? new Date(`${value}T00:00:00+07:00`) : value);
}

export function formatThaiMonth(value: string | Date) {
  return thaiMonth.format(typeof value === "string" ? new Date(`${value}-01T00:00:00+07:00`) : value);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} นาที`;
  return remaining ? `${hours} ชม. ${remaining} นาที` : `${hours} ชั่วโมง`;
}

export const statusLabel = {
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
} as const;
