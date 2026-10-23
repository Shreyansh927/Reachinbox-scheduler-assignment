import { useMemo, useState, type FormEvent } from "react";
import { X, Upload, Users, CalendarClock } from "lucide-react";
import type { ScheduleInput } from "../types/email";

type Props = {
  onClose: () => void;
  onSchedule: (input: ScheduleInput) => Promise<void>;
};

function parseAddresses(value: string) {
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const cleaned = matches.map((email) => email.trim().toLowerCase());
  const valid = [...new Set(cleaned)];
  return { valid, invalid: cleaned.length - valid.length };
}

export default function ComposeModal({ onClose, onSchedule }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rawEmails, setRawEmails] = useState("");
  const [startTime, setStartTime] = useState(() =>
    new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16),
  );
  const [delay, setDelay] = useState("2000");
  const [limit, setLimit] = useState("50");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const parsed = useMemo(() => parseAddresses(rawEmails), [rawEmails]);

  async function readFile(file?: File) {
    if (!file) return;
    setRawEmails(await file.text());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!parsed.valid.length)
      return setError("Add at least one valid email address.");
    if (new Date(startTime).getTime() < Date.now())
      return setError("Start time must be in the future.");
    if (!subject.trim() || !body.trim())
      return setError("Subject and message are required.");
    setSending(true);
    try {
      await onSchedule({
        subject: subject.trim(),
        body: body.trim(),
        emails: parsed.valid,
        startTime: new Date(startTime).toISOString(),
        delayBetweenMs: Number(delay),
        hourlyLimit: Number(limit),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not schedule emails.",
      );
      setSending(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="compose-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">NEW CAMPAIGN</span>
            <h2>Compose emails</h2>
            <p>Write once, schedule to your list.</p>
          </div>
          <button className="icon-button close-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label">
            Email subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="A quick introduction"
              maxLength={200}
              required
            />
          </label>
          <label className="field-label">
            Message
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Hi there, I wanted to reach out…"
              rows={4}
              required
            />
          </label>
          <div className="field-label">
            Recipients <span className="optional-note">CSV or plain text</span>
            <label className="upload-box">
              <Upload size={18} />
              <span>
                <strong>Choose a file</strong> or paste addresses below
              </span>
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(event) => readFile(event.target.files?.[0])}
              />
            </label>
            <textarea
              className="recipient-input"
              value={rawEmails}
              onChange={(event) => setRawEmails(event.target.value)}
              placeholder="alex@example.com, sam@example.com"
              rows={3}
            />
            <div className="recipient-count">
              <Users size={15} />
              <strong>{parsed.valid.length} valid emails found</strong>
              <span>{parsed.invalid} duplicates removed</span>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Start time
              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
              <span className="field-hint">
                <CalendarClock size={13} /> Uses your local time
              </span>
            </label>
            <label className="field-label">
              Delay between emails (ms)
              <input
                type="number"
                min="0"
                max="3600000"
                value={delay}
                onChange={(event) => setDelay(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Hourly limit per sender
              <input
                type="number"
                min="1"
                max="10000"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                required
              />
            </label>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={sending || parsed.valid.length === 0}
            >
              {sending
                ? "Scheduling…"
                : `Schedule ${parsed.valid.length || ""} emails`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
