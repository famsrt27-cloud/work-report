export type AppRole = "staff" | "supervisor" | "manager" | "admin";
export type TaskStatus = "in_progress" | "completed" | "cancelled";
export type SourceType = "document" | "person" | "routine" | "other";

export interface ViewerProfile {
  user_id: string;
  username: string;
  full_name: string;
  position: string | null;
  department_id: string | null;
  must_change_password: boolean;
  is_active: boolean;
  roles: AppRole[];
}

export interface DashboardMetrics {
  uniqueTasks: number;
  workLogs: number;
  completed: number;
  inProgress: number;
  cancelled: number;
  durationMinutes: number;
  overdue: number;
}
