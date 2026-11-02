import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/permissions";

export default async function HomePage() {
  const viewer = await getViewer();
  redirect(viewer ? (viewer.must_change_password ? "/change-password" : "/dashboard") : "/login");
}
