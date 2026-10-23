import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, Mail, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import Header from "./components/Header";
import EmailTable from "./components/EmailTable";
import ComposeModal from "./components/ComposeModal";
import { api, googleLoginUrl } from "./lib/api";
import type { ScheduledEmail, SentEmail, User, ScheduleInput } from "./types/email";

type Tab = "scheduled" | "sent";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadEmails = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [scheduledData, sentData] = await Promise.all([api.scheduled(), api.sent()]);
      setScheduled(scheduledData.emails);
      setSent(sentData.emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load emails.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    api.me().then((data) => setUser(data.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user) loadEmails();
  }, [user, loadEmails]);

  async function schedule(input: ScheduleInput) {
    const result = await api.schedule(input);
    setShowCompose(false);
    setNotice(`${result.created} emails scheduled${result.duplicatesRemoved ? ` · ${result.duplicatesRemoved} duplicates removed` : ""}.`);
    await loadEmails();
    window.setTimeout(() => setNotice(""), 5000);
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setScheduled([]);
      setSent([]);
    }
  }

  if (!user) return <main className="login-page"><div className="login-card"><div className="brand login-brand"><span className="brand-icon"><Mail size={20} /></span><span>reachinbox<span className="brand-light">.</span></span></div><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-mail"><Mail size={42} strokeWidth={1.5} /></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" /></div><span className="eyebrow">EMAIL CAMPAIGNS, SIMPLIFIED</span><h1>Make every email<br />feel <span>well timed.</span></h1><p>Schedule your outreach, keep track of every send, and spend more time on the conversations that matter.</p><a className="button primary google-button" href={googleLoginUrl}><span className="google-mark">G</span>Continue with Google <ArrowUpRight size={17} /></a><div className="login-foot"><span><span className="live-dot" /> Secure Google sign-in</span><span>Built for thoughtful outreach</span></div></div></main>;

  return <div className="app-shell"><Header user={user} onLogout={logout} /><main className="dashboard"><div className="welcome-row"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Email dashboard</h1><p>Keep your outreach organized and right on time.</p></div><button className="button primary compose-button" onClick={() => setShowCompose(true)}><Plus size={17} /> Compose new email</button></div>
    <div className="stats-row"><div className="stat-card"><span className="stat-icon blue"><Mail size={18} /></span><div><span>Scheduled</span><strong>{scheduled.length}</strong></div><span className="stat-caption">In your queue</span></div><div className="stat-card"><span className="stat-icon green"><Send size={18} /></span><div><span>Sent successfully</span><strong>{sent.filter((email) => email.status === "sent").length}</strong></div><span className="stat-caption">All time</span></div><div className="stat-card"><span className="stat-icon purple"><Sparkles size={18} /></span><div><span>Campaign health</span><strong>{sent.length ? `${Math.round((sent.filter((email) => email.status === "sent").length / sent.length) * 100)}%` : "—"}</strong></div><span className="stat-caption">Delivery success</span></div></div>
    <section className="emails-panel"><div className="panel-heading"><div><h2>Your emails</h2><p>Track every message from scheduled to sent.</p></div><button className={`icon-button refresh-button ${refreshing ? "spinning" : ""}`} title="Refresh emails" onClick={() => { setRefreshing(true); loadEmails(true); }}><RefreshCw size={16} /></button></div><div className="tabs"><button className={tab === "scheduled" ? "active" : ""} onClick={() => setTab("scheduled")}>Scheduled <span>{scheduled.length}</span></button><button className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>Sent <span>{sent.length}</span></button></div><EmailTable emails={tab === "scheduled" ? scheduled : sent} loading={loading} error={error} kind={tab} /></section>
    <div className="dashboard-foot"><span><span className="live-dot" /> Scheduler is running</span><span><Check size={14} /> Your emails are stored securely</span></div>
  </main>{notice ? <div className="toast"><Check size={17} />{notice}</div> : null}{showCompose ? <ComposeModal onClose={() => setShowCompose(false)} onSchedule={schedule} /> : null}</div>;
}
