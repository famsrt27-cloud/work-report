import Link from "next/link";
import { notFound } from "next/navigation";
import { FileUploader } from "@/components/files/file-uploader";
import { PrivateFileLink } from "@/components/files/private-file-link";
import { SingleReportButton } from "@/components/reports/single-report-button";
import { EvidenceManager } from "@/components/evidence/evidence-manager";
import { StatusPill } from "@/components/status-pill";
import { formatDuration, formatThaiDate } from "@/lib/format";
import { requireViewer } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: task } = await supabase.from("tasks").select("id, task_code, title, description, owner_user_id, received_date, due_date, task_status, created_at").eq("id", id).single();
  if (!task) notFound();
  const [ownerResult, sourceResult, docsResult, logsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, position").eq("user_id", task.owner_user_id).single(),
    supabase.from("task_sources").select("*").eq("task_id", id).maybeSingle(),
    supabase.from("source_documents").select("id, original_name, size_bytes, created_at").eq("task_id", id).order("created_at"),
    supabase.from("work_logs").select("id, work_date, activity_detail, result_text, duration_minutes, quantity, unit").eq("task_id", id).order("work_date", { ascending: false }),
  ]);
  const logs = logsResult.data ?? [];
  const logIds = logs.map((log) => log.id);
  const { data: evidence } = logIds.length ? await supabase.from("evidence_images").select("id, work_log_id, original_name, caption, display_order, include_in_pdf").in("work_log_id", logIds).order("display_order") : { data: [] };

  return <main className="content">
    <section className="detail-header"><div className="task-code">{task.task_code}</div><h1>{task.title}</h1><div className="detail-meta"><StatusPill status={task.task_status} /><span>ผู้รับผิดชอบ {ownerResult.data?.full_name ?? "ไม่ระบุ"}</span><span>รับงาน {formatThaiDate(task.received_date)}</span><span>กำหนดส่ง {formatThaiDate(task.due_date)}</span></div></section>
    <div className="heading-actions" style={{ marginBottom: 20 }}><Link className="button button-primary" href={`/tasks/${id}/logs/new`}>เพิ่มบันทึกการปฏิบัติงาน</Link><SingleReportButton taskId={id} taskCode={task.task_code} /></div>
    <section className="section-grid">
      <div style={{ display: "grid", gap: 18 }}>
        <div className="panel"><div className="panel-head"><h2>รายละเอียดงาน</h2></div><div className="panel-body"><p style={{ lineHeight: 1.75, marginTop: 0 }}>{task.description || "ไม่ได้ระบุรายละเอียดเพิ่มเติม"}</p>{sourceResult.data ? <div className="notice">ที่มา: {sourceResult.data.originating_unit || sourceResult.data.assigner_name || sourceResult.data.reference_no || "ระบุประเภทที่มาของงานแล้ว"}</div> : null}</div></div>
        <div className="panel"><div className="panel-head"><h2>บันทึกการปฏิบัติงาน</h2><span>{logs.length} รายการ</span></div><div className="panel-body">{logs.length ? <div className="timeline">{logs.map((log) => <article className="log-item" key={log.id}><div className="log-card"><time>{formatThaiDate(log.work_date)}{log.duration_minutes ? ` • ${formatDuration(log.duration_minutes)}` : ""}</time><h3>{log.activity_detail}</h3><p><strong>ผลลัพธ์:</strong> {log.result_text}</p><EvidenceManager items={(evidence ?? []).filter((image) => image.work_log_id === log.id)} /><div style={{ marginTop: 14 }}><FileUploader endpoint={`/api/work-logs/${log.id}/evidence`} accept="image/jpeg,image/png,image/webp" label="เพิ่มรูปหลักฐาน" /></div></div></article>)}</div> : <div className="empty"><strong>ยังไม่มีบันทึกงาน</strong>เพิ่มสิ่งที่ปฏิบัติจริงในแต่ละวัน</div>}</div></div>
      </div>
      <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <div className="panel"><div className="panel-head"><h2>หนังสือต้นเรื่อง</h2></div><div className="panel-body">{docsResult.data?.length ? <div className="list-stack">{docsResult.data.map((doc) => <div key={doc.id}><PrivateFileLink kind="source" id={doc.id}>{doc.original_name}</PrivateFileLink><small style={{ display: "block", color: "#607184" }}>{Math.ceil(doc.size_bytes / 1024)} KB</small></div>)}</div> : <p style={{ color: "#607184" }}>ยังไม่มีไฟล์แนบ</p>}<div style={{ marginTop: 18 }}><FileUploader endpoint={`/api/tasks/${id}/source-documents`} accept="application/pdf" label="แนบ PDF ต้นเรื่อง" /></div></div></div>
        <div className="notice">ระบบสร้างรายงาน PDF ใหม่ทุกครั้งที่ดาวน์โหลด และไม่ได้จัดเก็บไฟล์รายงานที่สร้างไว้ในระบบ</div>
      </aside>
    </section>
  </main>;
}
