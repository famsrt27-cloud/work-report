import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { hasPublicSupabaseEnv } from "@/lib/config";
import { requireViewer } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasPublicSupabaseEnv) return <SetupNotice />;
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
