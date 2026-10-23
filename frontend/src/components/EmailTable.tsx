import { Clock3, MailCheck, MailX } from "lucide-react";
import type { EmailRow } from "../types/email";

type Props = { emails: EmailRow[]; loading: boolean; error: string; kind: "scheduled" | "sent" };

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function EmailTable({ emails, loading, error, kind }: Props) {
  if (loading) return <div className="table-state"><span className="spinner" />Loading emails…</div>;
  if (error) return <div className="table-state error-state">{error}</div>;
  if (!emails.length) return <div className="table-state empty-state"><span className="empty-icon"><MailCheck size={23} /></span><strong>No {kind} emails yet</strong><span>{kind === "scheduled" ? "Compose an email campaign and it will show up here." : "Successfully sent and failed emails will appear here."}</span></div>;

  return <div className="table-wrap"><table><thead><tr><th>RECIPIENT</th><th>SUBJECT</th><th>{kind === "scheduled" ? "SCHEDULED FOR" : "SENT AT"}</th><th>STATUS</th></tr></thead><tbody>
    {emails.map((email) => <tr key={email.id}><td><div className="recipient-cell"><span className="recipient-avatar">{email.recipient.slice(0, 1).toUpperCase()}</span><span>{email.recipient}</span></div></td><td className="subject-cell">{email.subject}</td><td><span className="date-cell"><Clock3 size={14} />{dateLabel(kind === "scheduled" ? email.scheduled_at : ("sent_at" in email ? email.sent_at : null))}</span></td><td><span className={`status-pill ${email.status}`}>{email.status === "failed" ? <MailX size={13} /> : null}{email.status}</span>{"failure_reason" in email && email.failure_reason ? <div className="failure-reason">{email.failure_reason}</div> : null}</td></tr>)}
  </tbody></table></div>;
}
