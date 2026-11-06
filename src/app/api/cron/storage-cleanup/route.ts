import { cleanupStoredFiles } from "@/lib/storage/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupStoredFiles({ before: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("[cron:storage-cleanup] failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: "Storage cleanup failed" }, { status: 500 });
  }
}
