export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship<Columns extends string, Relation extends string, ReferencedColumns extends string> = {
  foreignKeyName: string;
  columns: Columns[];
  isOneToOne: boolean;
  referencedRelation: Relation;
  referencedColumns: ReferencedColumns[];
};
type Row<T, R extends readonly unknown[] = []> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: R };

export interface Database {
  public: {
    Tables: {
      profiles: Row<{
        user_id: string; username: string; full_name: string; position: string | null;
        department_id: string | null; must_change_password: boolean; is_active: boolean;
        created_at: string; updated_at: string;
      }, [Relationship<"department_id", "departments", "id">]>;
      user_roles: Row<{
        id: string; user_id: string; role: "staff" | "supervisor" | "manager" | "admin";
        scoped_department_id: string | null; created_at: string;
      }>;
      departments: Row<{ id: string; name: string; parent_id: string | null; active: boolean; created_at: string }>;
      task_categories: Row<{ id: string; code: string; name: string; active: boolean; created_at: string }>;
      tasks: Row<{
        id: string; task_code: string; title: string; description: string | null; category_id: string | null;
        owner_user_id: string; received_date: string | null; due_date: string | null;
        task_status: "in_progress" | "completed" | "cancelled"; created_by: string;
        created_at: string; updated_at: string;
      }, [
        Relationship<"category_id", "task_categories", "id">,
        Relationship<"owner_user_id", "profiles", "user_id">,
        Relationship<"created_by", "profiles", "user_id">
      ]>;
      task_collaborators: Row<{ task_id: string; user_id: string; created_at: string }>;
      task_sources: Row<{
        task_id: string; source_type: "document" | "person" | "routine" | "other" | null;
        originating_unit: string | null; assigner_name: string | null; assigner_position: string | null;
        reference_no: string | null; reference_date: string | null; source_note: string | null; updated_at: string;
      }, [Relationship<"task_id", "tasks", "id">]>;
      source_documents: Row<{
        id: string; task_id: string; bucket: string; storage_key: string; original_name: string;
        mime: string; size_bytes: number; sha256: string; uploaded_by: string; created_at: string;
      }, [Relationship<"task_id", "tasks", "id">]>;
      work_logs: Row<{
        id: string; task_id: string; created_by: string; work_date: string; activity_detail: string;
        result_text: string; time_start: string | null; time_end: string | null; duration_minutes: number | null;
        quantity: number | null; unit: string | null; created_at: string; updated_at: string;
      }, [Relationship<"task_id", "tasks", "id">]>;
      evidence_images: Row<{
        id: string; work_log_id: string; bucket: string; storage_key: string; original_name: string;
        mime: string; size_bytes: number; caption: string | null; evidence_type: string | null;
        display_order: number; include_in_pdf: boolean; sha256: string; uploaded_by: string; created_at: string;
      }, [Relationship<"work_log_id", "work_logs", "id">]>;
      task_status_history: Row<{
        id: number; task_id: string; old_status: "in_progress" | "completed" | "cancelled" | null;
        new_status: "in_progress" | "completed" | "cancelled"; changed_by: string | null; changed_at: string;
      }, [Relationship<"task_id", "tasks", "id">]>;
      reviews: Row<{
        id: string; entity_type: "task" | "report_snapshot"; entity_id: string; reviewer_id: string;
        status: "pending" | "approved" | "returned"; note: string | null; created_at: string; updated_at: string;
      }>;
      report_snapshots: Row<{
        id: string; report_type: "single" | "monthly"; subject_user_id: string; period_start: string;
        period_end: string; snapshot_json: Json; revision: number; review_status: string; created_by: string; created_at: string;
      }>;
      notifications: Row<{
        id: number; recipient_user_id: string; type: string; title: string; body: string;
        entity_type: string | null; entity_id: string | null; created_at: string; read_at: string | null;
        dedupe_key: string | null;
      }>;
      auth_login_attempts: Row<{
        id: number; account_hash: string; ip_hash: string; attempted_at: string; successful: boolean;
      }>;
      audit_events: Row<{
        id: number; actor_id: string | null; entity_type: string; entity_id: string | null;
        action: string; safe_diff_json: Json; created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
