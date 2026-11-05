import assert from "node:assert/strict";
import test from "node:test";
import { internalEmailForUsername, usernameSchema } from "../src/lib/auth/internal-identifier.ts";
import { durationBetween, taskSchema } from "../src/lib/validations/tasks.ts";

test("username preserves a leading zero and requires exactly seven digits", () => {
  assert.equal(usernameSchema.parse("0123456"), "0123456");
  for (const invalid of ["123456", "12345678", "12A4567", " 1234567"])
    assert.equal(usernameSchema.safeParse(invalid).success, false);
});

test("internal email is derived only after username validation", () => {
  assert.equal(internalEmailForUsername("0123456"), "0123456@work-report.invalid");
  assert.throws(() => internalEmailForUsername("admin"));
});

test("work duration is calculated only for a same-day valid range", () => {
  assert.equal(durationBetween("08:30", "10:15"), 105);
  assert.equal(durationBetween("18:00", "08:00"), null);
  assert.equal(durationBetween(undefined, "08:00"), null);
});

test("task due date cannot be before the received date", () => {
  const result = taskSchema.safeParse({
    title: "ทดสอบงาน",
    taskStatus: "in_progress",
    receivedDate: "2026-11-05",
    dueDate: "2026-11-04",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "กำหนดส่งต้องไม่ก่อนวันที่รับงาน");
});
