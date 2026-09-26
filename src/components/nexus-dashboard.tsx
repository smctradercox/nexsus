"use client";

import { motion } from "framer-motion";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check,
  CheckCircle2, Clock3, Copy, CreditCard, FileImage, KeyRound,
  LayoutDashboard, LogOut, ShieldCheck, Sparkles, Upload, UserRound,
  Wallet, X, Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

type SubscriptionStatus = "active" | "pending" | "inactive" | "expired";
type User = {
  id: string; username: string; isAdmin: boolean; isActive: boolean;
  subscriptionStatus: SubscriptionStatus; subscriptionExpiresAt: string | null;
};
type AnalysisResult = {
  marketBias: "Bullish" | "Bearish" | "Neutral"; supportLevels: string[];
  resistanceLevels: string[]; entryZone: string | null; stopLoss: string | null;
  takeProfit: string[]; technicalSummary: string; strategyAdvice: string;
};
type Analysis = { id: string; result: AnalysisResult; createdAt: string };
type Payment = { id: string; status: "pending" | "approved" | "rejected"; createdAt: string; reviewedAt?: string | null };
type AdminPayment = Payment & { username: string; receiptFileId: string };
type Notice = { kind: "success" | "error"; text: string } | null;
const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analysis", label: "Chart analysis", icon: BarChart3 },
  { id: "subscription", label: "Subscription", icon: CreditCard },
] as const;
type View = (typeof navItems)[number]["id"] | "admin";
const statusLabels: Record<SubscriptionStatus, string> = {
  active: "Active plan", pending: "Awaiting review", inactive: "No active plan", expired: "Plan expired",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-panel ${className}`}>{children}</section>;
}

function StatusPill({ status }: { status: SubscriptionStatus }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Authentication failed.");
      const profile = await fetch("/api/auth/me", { cache: "no-store" });
      const profileData = await profile.json();
      if (!profile.ok) throw new Error(profileData.error ?? "Could not load account.");
      onAuthenticated(profileData.user as User);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  async function clearSession() {
    await fetch("/api/auth/logout", { method: "POST" });
    setError("");
  }

  return (
    <main className="auth-page">
      <div className="auth-grid" aria-hidden="true" />
      <motion.section className="auth-layout" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="auth-story">
          <a className="brand-mark" href="/" aria-label="NEXUS home"><span className="brand-glyph"><Activity size={19} strokeWidth={2.4} /></span><span>NEXUS<span className="brand-period">.</span></span></a>
          <p className="eyebrow">MARKET INTELLIGENCE / 01</p>
          <h1>Read the chart.<br /><span>Find the edge.</span></h1>
          <p className="auth-copy">Structure, liquidity and price action, in one focused workspace.</p>
          <div className="auth-signal"><span className="signal-line" /><span>AI-assisted technical analysis</span></div>
        </div>
        <GlassPanel className="auth-panel">
          <div className="auth-panel-top"><div className="auth-icon"><KeyRound size={19} /></div><span className="eyebrow">YOUR WORKSPACE</span></div>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="panel-subtitle">{mode === "login" ? "Sign in to continue to NEXUS." : "Choose a username and a 6-digit password."}</p>
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="username">Username</label>
            <div className="input-shell"><UserRound size={17} /><input id="username" name="username" autoComplete="username" minLength={mode === "register" ? 3 : undefined} maxLength={32} required placeholder="e.g. alex_trades" /></div>
            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-shell"><KeyRound size={17} /><input id="password" name="password" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="6 digits" /></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={17} /></button>
          </form>
          <div className="auth-switch"><span>{mode === "login" ? "New to NEXUS?" : "Already have an account?"}<button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create account" : "Sign in"}</button></span></div>
          <div className="auth-secure"><ShieldCheck size={15} /> Encrypted session · Private workspace</div>
          <button className="auth-clear-session" type="button" onClick={clearSession}>Clear saved session</button>
        </GlassPanel>
      </motion.section>
      <div className="auth-foot"><span>NEXUS TERMINAL</span><span>Independent market analysis</span><span>01 — 03</span></div>
    </main>
  );
}

function AnalysisResultPanel({ result }: { result: AnalysisResult }) {
  const biasClass = result.marketBias.toLowerCase();
  return (
    <div className="result-wrap">
      <div className="result-heading"><div><span className="eyebrow">MODEL READOUT</span><h3>Chart analysis</h3></div><span className={`bias-tag bias-${biasClass}`}><span className="bias-marker" />{result.marketBias} bias</span></div>
      <div className="levels-grid">
        <div className="level-block"><span className="level-label"><ArrowDownRight size={15} /> SUPPORT</span>{result.supportLevels.length ? result.supportLevels.map((level) => <strong key={level}>{level}</strong>) : <span className="muted">No clear levels</span>}</div>
        <div className="level-block"><span className="level-label resistance-label"><ArrowUpRight size={15} /> RESISTANCE</span>{result.resistanceLevels.length ? result.resistanceLevels.map((level) => <strong key={level}>{level}</strong>) : <span className="muted">No clear levels</span>}</div>
      </div>
      <div className="trade-grid"><div><span>ENTRY ZONE</span><strong>{result.entryZone ?? "Unclear"}</strong></div><div><span>STOP LOSS</span><strong>{result.stopLoss ?? "Unclear"}</strong></div><div><span>TAKE PROFIT</span><strong>{result.takeProfit.length ? result.takeProfit.join(" · ") : "Unclear"}</strong></div></div>
      <div className="analysis-note"><span className="eyebrow">TECHNICAL SUMMARY</span><p>{result.technicalSummary}</p></div>
      <div className="analysis-note strategy-note"><span className="eyebrow">STRATEGY ADVICE</span><p>{result.strategyAdvice}</p></div>
      <p className="disclaimer">Educational analysis only. Not financial advice; verify levels independently.</p>
    </div>
  );
}

function ChartUploader({ active, onResult, onNotice, onNeedSubscription }: {
  active: boolean; onResult: (analysis: Analysis) => void; onNotice: (notice: Notice) => void; onNeedSubscription: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(candidate?: File) {
    if (!candidate) return;
    if (!new Set(["image/png", "image/jpeg"]).has(candidate.type) || candidate.size > 4 * 1024 * 1024) {
      onNotice({ kind: "error", text: "Select a PNG or JPG up to 4 MB." }); return;
    }
    setFile(candidate);
  }

  async function analyze() {
    if (!active) { onNeedSubscription(); return; }
    if (!file) { onNotice({ kind: "error", text: "Choose a chart screenshot first." }); return; }
    setBusy(true);
    const form = new FormData(); form.set("chart", file);
    try {
      const response = await fetch("/api/analyses", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
      onResult(data.analysis as Analysis); onNotice({ kind: "success", text: "Chart analysis is ready." }); setFile(null);
    } catch (error) { onNotice({ kind: "error", text: error instanceof Error ? error.message : "Analysis failed." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="chart-workspace">
      {!active && <div className="locked-banner"><ShieldCheck size={18} /><span>Chart analysis requires an active subscription.</span><button className="text-action" onClick={onNeedSubscription}>View plan <ArrowRight size={14} /></button></div>}
      <div className={`dropzone ${dragging ? "dropzone-active" : ""} ${preview ? "dropzone-has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
        {preview ? <img className="chart-preview" src={preview} alt="Selected chart screenshot preview" /> : <div className="dropzone-empty"><div className="upload-orbit"><Upload size={23} /></div><strong>Drop a chart screenshot here</strong><span>PNG or JPG · Up to 4 MB</span></div>}
        <input aria-label="Select chart screenshot" type="file" accept="image/png,image/jpeg" onChange={(event) => chooseFile(event.target.files?.[0])} />
        {preview && <button className="remove-file" aria-label="Remove selected image" onClick={() => setFile(null)}><X size={16} /></button>}
      </div>
      <div className="upload-controls"><span className="file-label">{file ? <><FileImage size={15} />{file.name}</> : "One clear chart, one focused readout"}</span><button className="button button-primary" onClick={analyze} disabled={busy || !active}>{busy ? <><span className="spinner" />Reading chart...</> : <><Sparkles size={16} />Analyze chart</>}</button></div>
    </div>
  );
}

export default function NexusDashboard({ walletAddress, walletQr }: { walletAddress: string; walletQr: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [adminPayments, setAdminPayments] = useState<AdminPayment[]>([]);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewingId, setReviewingId] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (mounted && data?.user) setUser(data.user as User); })
      .catch(() => { if (mounted) setNotice({ kind: "error", text: "Could not reach the account service." }); })
      .finally(() => { if (mounted) setSessionChecked(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user?.isAdmin && new URLSearchParams(window.location.search).get("view") === "admin") {
      setView("admin");
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([
      fetch("/api/analyses", { cache: "no-store" }).then((response) => response.ok ? response.json() : { analyses: [] }),
      fetch("/api/payments", { cache: "no-store" }).then((response) => response.ok ? response.json() : { payments: [] }),
      user.isAdmin ? fetch("/api/admin/payments", { cache: "no-store" }).then((response) => response.ok ? response.json() : { payments: [] }) : Promise.resolve({ payments: [] }),
    ]).then(([analysisData, paymentData, adminData]) => {
      if (!mounted) return;
      setAnalyses(analysisData.analyses as Analysis[]); setPayments(paymentData.payments as Payment[]); setAdminPayments(adminData.payments as AdminPayment[]);
    }).catch(() => { if (mounted) setNotice({ kind: "error", text: "Some workspace data could not be loaded." }); });
    return () => { mounted = false; };
  }, [user]);

  async function refreshUser() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (response.ok) { const data = await response.json(); setUser(data.user as User); }
  }

  async function copyWallet() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt) { setNotice({ kind: "error", text: "Choose your transfer screenshot first." }); return; }
    setReceiptBusy(true);
    const form = new FormData(); form.set("receipt", receipt);
    try {
      const response = await fetch("/api/payments", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Receipt could not be submitted.");
      setPayments((current) => [{ ...data.payment, createdAt: new Date().toISOString() }, ...current]); setReceipt(null); await refreshUser();
      setNotice({ kind: "success", text: "Receipt sent securely. Your request is awaiting review." });
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Receipt could not be submitted." }); }
    finally { setReceiptBusy(false); }
  }

  async function reviewPayment(paymentId: string, status: "approved" | "rejected") {
    setReviewingId(paymentId);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Payment could not be reviewed.");
      setAdminPayments((current) => current.filter((payment) => payment.id !== paymentId));
      setNotice({ kind: "success", text: status === "approved" ? "Subscription activated for 30 days." : "Payment was rejected." });
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Payment could not be reviewed." }); }
    finally { setReviewingId(""); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setAnalyses([]); setPayments([]); setView("overview");
  }

  function acceptAnalysis(analysis: Analysis) {
    setAnalyses((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)].slice(0, 20)); setView("analysis");
  }

  if (!sessionChecked) return <main className="boot-screen"><div className="boot-mark"><Activity size={21} /></div><span>Connecting to NEXUS</span><div className="boot-line" /></main>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  const latestPayment = payments[0];
  const subscriptionStatus = user.subscriptionStatus;

  return (
    <main className="app-shell">
      <div className="app-grain" aria-hidden="true" />
      <aside className="sidebar">
        <a className="brand-mark sidebar-brand" href="/" aria-label="NEXUS home"><span className="brand-glyph"><Activity size={18} strokeWidth={2.4} /></span><span>NEXUS<span className="brand-period">.</span></span></a>
        <div className="workspace-label"><span className="eyebrow">WORKSPACE</span><span className="workspace-live"><span /> LIVE</span></div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => <button key={item.id} className={`nav-item ${view === item.id ? "nav-item-active" : ""}`} onClick={() => setView(item.id)}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "analysis" && analyses.length > 0 && <span className="nav-count">{analyses.length}</span>}</button>)}
          {user.isAdmin && <button className={`nav-item ${view === "admin" ? "nav-item-active" : ""}`} onClick={() => setView("admin")}><ShieldCheck size={17} strokeWidth={1.8} /><span>Payment review</span>{adminPayments.length > 0 && <span className="nav-count nav-count-alert">{adminPayments.length}</span>}</button>}
        </nav>
        <div className="sidebar-bottom"><div className="plan-mini"><div className="plan-mini-icon"><Zap size={16} /></div><div><span className="eyebrow">YOUR PLAN</span><strong>{subscriptionStatus === "active" ? "NEXUS Pro" : (statusLabels[subscriptionStatus] || statusLabels["active"] || "ACTIVE")}</strong></div><span className={`plan-indicator plan-${subscriptionStatus}`} /></div><div className="profile-row"><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user.username}</strong><span>{user.isAdmin ? "Administrator" : "Member"}</span></div><button className="icon-button signout-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></button></div></div>
      </aside>

      <section className="main-column">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{navItems.find((item) => item.id === view)?.label ?? "Payment review"}</strong></div><div className="topbar-right"><div className="market-live"><span className="pulse-dot" /> SYSTEM ONLINE</div><StatusPill status={subscriptionStatus} /><div className="top-avatar">{user.username.slice(0, 1).toUpperCase()}</div></div></header>
        {notice && <motion.div className={`notice notice-${notice.kind}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="status"><span>{notice.kind === "success" ? <CheckCircle2 size={17} /> : <X size={17} />}{notice.text}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></motion.div>}

        <motion.div className="content-area" key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
          {view === "overview" && <>
            <div className="page-heading"><div><span className="eyebrow">NEXUS TERMINAL / OVERVIEW</span><h1>Good to see you, <span>@{user.username}</span></h1><p>Your chart intelligence workspace is ready.</p></div><div className="heading-date"><span className="date-mark" /><span>MARKET DESK <strong>01 / 01</strong></span></div></div>
            <div className="overview-stats"><GlassPanel className="stat-panel"><div className="stat-top"><span>SUBSCRIPTION</span><Zap size={16} /></div><div className="stat-value stat-status">{subscriptionStatus === "active" ? "PRO ACTIVE" : (statusLabels[subscriptionStatus] || statusLabels["active"] || "ACTIVE").toUpperCase()}</div><div className="stat-foot">{subscriptionStatus === "active" ? `Access through ${formatDate(user.subscriptionExpiresAt)}` : "Manual verification"}</div></GlassPanel><GlassPanel className="stat-panel"><div className="stat-top"><span>ANALYSES RUN</span><BarChart3 size={16} /></div><div className="stat-value">{analyses.length.toString().padStart(2, "0")}<span className="stat-unit"> / 20</span></div><div className="stat-foot">Rolling 24-hour history</div></GlassPanel><GlassPanel className="stat-panel"><div className="stat-top"><span>PAYMENT REQUEST</span><Clock3 size={16} /></div><div className="stat-value stat-status">{latestPayment?.status.toUpperCase() ?? "NONE"}</div><div className="stat-foot">{latestPayment ? `Submitted ${formatDate(latestPayment.createdAt)}` : "No receipt submitted"}</div></GlassPanel></div>
            <div className="overview-grid"><GlassPanel className="welcome-panel"><div className="welcome-top"><span className="eyebrow">ANALYSIS CONSOLE</span><span className="console-code">NX–CHART / 001</span></div><div className="welcome-art"><div className="chart-crosshair crosshair-one" /><div className="chart-crosshair crosshair-two" /><div className="chart-curve"><svg viewBox="0 0 540 160" preserveAspectRatio="none" aria-hidden="true"><path d="M0 125 L52 109 L94 118 L138 72 L177 93 L218 48 L260 68 L304 30 L344 60 L391 21 L428 39 L476 12 L540 18" /><path className="chart-curve-glow" d="M0 125 L52 109 L94 118 L138 72 L177 93 L218 48 L260 68 L304 30 L344 60 L391 21 L428 39 L476 12 L540 18" /></svg></div><div className="chart-readout"><span>STRUCTURE</span><strong>IN FOCUS</strong></div><div className="chart-price"><span>MARKET BIAS</span><strong>{analyses[0]?.result.marketBias.toUpperCase() ?? "AWAITING INPUT"}</strong></div></div><div className="welcome-footer"><div><Sparkles size={17} /><span>Support · Resistance · Liquidity · Structure</span></div><button className="button button-primary" onClick={() => setView("analysis")}>Open analysis <ArrowRight size={16} /></button></div></GlassPanel>
              <div className="overview-side"><GlassPanel className="subscription-callout"><div className="callout-icon"><Wallet size={18} /></div><span className="eyebrow">MEMBERSHIP</span><h3>{subscriptionStatus === "active" ? "Your desk is unlocked." : subscriptionStatus === "pending" ? "We are checking your transfer." : "Unlock chart intelligence."}</h3><p>{subscriptionStatus === "active" ? `Access active through ${formatDate(user.subscriptionExpiresAt)}.` : "One verified USDT transfer unlocks 30 days of analysis."}</p><button className="text-action" onClick={() => setView("subscription")}>{subscriptionStatus === "active" ? "View membership" : "Manage subscription"}<ArrowRight size={15} /></button></GlassPanel><GlassPanel className="recent-panel"><div className="section-title-row"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Latest reads</h3></div><button className="icon-button" aria-label="View all analyses" title="View all analyses" onClick={() => setView("analysis")}><ArrowRight size={17} /></button></div>{analyses.length ? analyses.slice(0, 3).map((analysis) => <button key={analysis.id} className="recent-row" onClick={() => setView("analysis")}><span className={`recent-bias bias-dot-${analysis.result.marketBias.toLowerCase()}`} /><span className="recent-copy"><strong>{analysis.result.marketBias} structure</strong><span>{formatDate(analysis.createdAt)}</span></span><ArrowRight size={14} /></button>) : <div className="empty-activity"><span className="empty-mark"><Activity size={18} /></span><span>No chart reads yet.</span><button className="text-action" onClick={() => setView("analysis")}>Start an analysis <ArrowRight size={14} /></button></div>}</GlassPanel></div>
            </div><div className="footer-line"><span>NEXUS INTELLIGENCE SYSTEM</span><span>DATA IS EDUCATIONAL · EXECUTE WITH DISCIPLINE</span><span>BUILD 1.0.0</span></div>
          </>}

          {view === "analysis" && <>
            <div className="page-heading"><div><span className="eyebrow">CHART INTELLIGENCE / VISION</span><h1>Read the <span>structure.</span></h1><p>Upload a chart and receive a structured technical readout.</p></div><div className="heading-date"><span className="date-mark" /><span>GEMINI VISION <strong>READY</strong></span></div></div>
            <GlassPanel className="analysis-panel"><div className="panel-heading"><div><span className="eyebrow">01 — INPUT</span><h2>Chart screenshot</h2></div><span className="panel-meta">PNG / JPG · MAX 4 MB</span></div><ChartUploader active={user.isActive} onResult={acceptAnalysis} onNotice={setNotice} onNeedSubscription={() => setView("subscription")} /></GlassPanel>
            {analyses[0] && <GlassPanel className="analysis-output"><div className="output-toolbar"><div><span className="eyebrow">02 — OUTPUT / {formatDate(analyses[0].createdAt)}</span><h2>Technical readout</h2></div><a className="image-open" href={`/api/analyses/${analyses[0].id}/image`} target="_blank" rel="noreferrer"><FileImage size={15} />View source image</a></div><AnalysisResultPanel result={analyses[0].result} /></GlassPanel>}
            <div className="history-heading"><div><span className="eyebrow">ARCHIVE</span><h2>Previous analyses</h2></div><span className="history-count">{analyses.length.toString().padStart(2, "0")} STORED</span></div>
            <div className="analysis-history">{analyses.length ? analyses.map((analysis) => <article className="history-row" key={analysis.id}><img src={`/api/analyses/${analysis.id}/image`} alt="Chart analyzed" loading="lazy" /><div className="history-main"><strong>{analysis.result.marketBias} market bias</strong><span>{formatDate(analysis.createdAt)} · {analysis.result.supportLevels.length} support / {analysis.result.resistanceLevels.length} resistance</span></div><span className={`bias-tag bias-${analysis.result.marketBias.toLowerCase()}`}>{analysis.result.marketBias}</span><button className="icon-button" title="Analysis details" aria-label="Analysis details" onClick={() => setNotice({ kind: "success", text: "Latest analysis is shown above." })}><ArrowRight size={16} /></button></article>) : <div className="empty-history">Your saved readouts will appear here.</div>}</div>
            <div className="footer-line"><span>AI-GENERATED TECHNICAL VIEW</span><span>VERIFY ALL LEVELS BEFORE TRADING</span><span>20 ANALYSES / 24H</span></div>
          </>}

          {view === "subscription" && <>
            <div className="page-heading"><div><span className="eyebrow">ACCOUNT / MEMBERSHIP</span><h1>Keep your <span>edge.</span></h1><p>Thirty days of chart intelligence, activated after manual payment review.</p></div><div className="heading-date"><span className="date-mark" /><span>MEMBERSHIP <strong>USD / 30D</strong></span></div></div>
            <div className="membership-grid"><GlassPanel className="membership-panel"><div className="membership-top"><div className="membership-icon"><Zap size={19} /></div><span className="eyebrow">NEXUS PRO / 30 DAYS</span><StatusPill status={subscriptionStatus} /></div><div className="price-line"><span className="currency">$</span><strong>80</strong><span className="price-period">USDT<br />/ 30 DAYS</span></div><div className="benefit-line"><Check size={16} />AI chart vision analysis</div><div className="benefit-line"><Check size={16} />Support, resistance and liquidity readout</div><div className="benefit-line"><Check size={16} />Private saved analysis history</div><div className="membership-rule" /><div className="expiry-line"><span>{subscriptionStatus === "active" ? "ACCESS THROUGH" : "CURRENT STATUS"}</span><strong>{subscriptionStatus === "active" ? formatDate(user.subscriptionExpiresAt) : (statusLabels[subscriptionStatus] || statusLabels["active"] || "ACTIVE")}</strong></div></GlassPanel>
              <GlassPanel className="payment-panel"><div className="panel-heading"><div><span className="eyebrow">PAYMENT / TRC-20 NETWORK</span><h2>Send USDT</h2></div><div className="network-tag"><span />TRON NETWORK</div></div><div className="payment-instructions"><span className="instruction-number">01</span><p>Send exactly <strong>80 USDT</strong> using the <strong>TRC-20 network</strong> to this address.</p></div>{walletAddress ? <div className="wallet-block"><div className="qr-frame"><img src={walletQr} alt="QR code for the NEXUS USDT TRC-20 deposit address" /></div><div className="wallet-details"><span className="eyebrow">DEPOSIT ADDRESS</span><div className="wallet-address">{walletAddress}</div><button className="button button-outline copy-button" onClick={copyWallet}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy address"}</button></div></div> : <div className="wallet-unset"><Wallet size={19} /><div><strong>Deposit wallet not configured</strong><span>Set USDT_TRC20_WALLET in the deployment environment.</span></div></div>}<div className="payment-warning"><ShieldCheck size={16} /><span>Confirm the network is TRC-20 before sending. Transfers cannot be reversed.</span></div><div className="payment-instructions receipt-instruction"><span className="instruction-number">02</span><p>Upload a screenshot of your completed transfer. Our team will verify it manually.</p></div><form className="receipt-form" onSubmit={submitReceipt}><label className={`receipt-picker ${receipt ? "receipt-selected" : ""}`}><input type="file" accept="image/png,image/jpeg" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} /><span className="receipt-icon"><FileImage size={17} /></span><span className="receipt-label"><strong>{receipt?.name ?? "Choose transfer screenshot"}</strong><span>PNG or JPG · Up to 4 MB</span></span><Upload size={17} /></label><button className="button button-primary receipt-submit" type="submit" disabled={receiptBusy || !!payments.find((payment) => payment.status === "pending")}>{receiptBusy ? <><span className="spinner" />Sending securely...</> : <><Upload size={16} />Submit for review</>}</button>{payments.some((payment) => payment.status === "pending") && <p className="pending-hint"><Clock3 size={14} />Your payment is already awaiting admin review.</p>}</form></GlassPanel></div>
            <div className="history-heading"><div><span className="eyebrow">PAYMENT LOG</span><h2>Recent requests</h2></div><span className="history-count">{payments.length.toString().padStart(2, "0")} RECORDS</span></div>
            <div className="payment-history">{payments.length ? payments.map((payment) => <div className="payment-history-row" key={payment.id}><div className={`payment-status-mark payment-mark-${payment.status}`} /><div className="history-main"><strong>USDT · TRC-20</strong><span>{formatDate(payment.createdAt)} · $80</span></div><span className={`payment-status-text payment-text-${payment.status}`}>{payment.status}</span><span className="history-id">{payment.id.slice(0, 8).toUpperCase()}</span></div>) : <div className="empty-history">No payment submissions yet.</div>}</div>
            <div className="footer-line"><span>NETWORK: TRON / TRC-20</span><span>MANUAL VERIFICATION REQUIRED</span><span>30 DAY ACCESS</span></div>
          </>}

          {view === "admin" && user.isAdmin && <>
            <div className="page-heading"><div><span className="eyebrow">ADMIN / PAYMENT OPERATIONS</span><h1>Review <span>transfers.</span></h1><p>Verify the transaction screenshot in Telegram before taking action.</p></div><div className="heading-date"><span className="date-mark" /><span>REVIEW QUEUE <strong>{adminPayments.length.toString().padStart(2, "0")}</strong></span></div></div>
            <GlassPanel className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">PENDING / {adminPayments.length.toString().padStart(2, "0")}</span><h2>Payment requests</h2></div><span className="admin-note"><ShieldCheck size={15} />Receipt is attached to Telegram alert</span></div>{adminPayments.length ? <div className="admin-list">{adminPayments.map((payment) => <div className="admin-row" key={payment.id}><div className="avatar admin-user-avatar">{payment.username.slice(0, 1).toUpperCase()}</div><div className="admin-user"><strong>{payment.username}</strong><span>{formatDate(payment.createdAt)} · $80 USDT</span><code>{payment.id.slice(0, 8)}</code></div><div className="admin-actions"><button className="button button-approve" disabled={reviewingId === payment.id} onClick={() => reviewPayment(payment.id, "approved")}><Check size={15} />Approve</button><button className="button button-reject" disabled={reviewingId === payment.id} onClick={() => reviewPayment(payment.id, "rejected")}><X size={15} />Reject</button></div></div>)}</div> : <div className="admin-empty"><div className="empty-mark"><CheckCircle2 size={19} /></div><strong>Queue is clear.</strong><span>New transfer receipts will appear in Telegram and here.</span></div>}</GlassPanel>
            <div className="footer-line"><span>ADMIN ACCESS</span><span>ACTIONS ARE RECORDED</span><span>PAYMENT REVIEW</span></div>
          </>}
        </motion.div>
      </section>
    </main>
  );
}