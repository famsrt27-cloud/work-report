import { statusLabel } from "@/lib/format";
import type { TaskStatus } from "@/types";

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`status status-${status}`}>{statusLabel[status]}</span>;
}
