import { NotificationList } from "@/components/notifications/notification-list";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "การแจ้งเตือน" };

export default async function NotificationsPage() {
  await requireViewer();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("notifications").select("id, title, body, created_at, read_at").order("created_at", { ascending: false }).limit(50);
  return <main className="content"><div className="page-heading"><div><h1>ศูนย์แจ้งเตือน</h1><p>งานใหม่ รายงานรอตรวจ และรายการที่ส่งกลับให้แก้ไข</p></div></div><NotificationList items={data ?? []} /></main>;
}
