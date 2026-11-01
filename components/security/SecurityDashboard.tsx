"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Smartphone,
  Lock,
  Globe,
  Monitor,
  ExternalLink,
  Sparkles,
  Filter,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";
import {
  type SecurityEvent,
  type BreachCorrelationResult,
  type EmergencyLockdownStep,
  type SecurityIntelligenceSummary,
} from "@/lib/intelligence/security/securityTypes";
import { type RiskEvaluationResult } from "@/lib/intelligence/risk/riskEngine";
import { type PrioritizedAction } from "@/lib/intelligence/recommendations/recommendationEngine";
import { consumeNdjsonStream } from "@/lib/ndjsonStream";

interface ScanProgress {
  stage: number;
  percent: number;
  message: string;
}

export function SecurityDashboard() {
  const { data: session, status } = useSession();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "TIMELINE" | "BREACHES" | "DEVICES" | "LOCKDOWN"
  >("OVERVIEW");

  // State data
  const [summary, setSummary] = useState<SecurityIntelligenceSummary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [breaches, setBreaches] = useState<BreachCorrelationResult[]>([]);
  const [lockdownSteps, setLockdownSteps] = useState<EmergencyLockdownStep[]>([]);
  const [riskEvaluation, setRiskEvaluation] = useState<RiskEvaluationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<PrioritizedAction[]>([]);

  // Filter states for Timeline
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>("ALL");
  const [timelineSeverityFilter, setTimelineSeverityFilter] = useState<string>("ALL");

  // Local user-confirmed mitigations
  const [mitigatedBreachNames, setMitigatedBreachNames] = useState<Set<string>>(new Set());

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setProgress({ stage: 1, percent: 10, message: "Initiating security audit…" });

    try {
      const response = await fetch("/api/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mitigatedBreaches: Array.from(mitigatedBreachNames),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Google session expired or authorization was revoked. Please sign in again.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Scan request failed with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response stream received from security endpoint.");
      }

      await consumeNdjsonStream(
        response.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          if (data.type === "progress") {
            setProgress({
              stage: data.stage || 1,
              percent: data.percent || 20,
              message: data.message || "Auditing security records…",
            });
          } else if (data.type === "done") {
            setSummary(data.summary);
            setEvents(data.events || []);
            setBreaches(data.breachCorrelations || []);
            setLockdownSteps(data.lockdownSteps || []);
            setRiskEvaluation(data.riskEvaluation || null);
            setActionPlan(data.actionPlan || []);
            setIsScanning(false);
            setProgress(null);
          } else if (data.type === "error") {
            throw new Error(data.error || "An error occurred during security analysis");
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete security scan");
      setIsScanning(false);
      setProgress(null);
    }
  };

  const toggleBreachRemediation = (breachName: string) => {
    setMitigatedBreachNames((prev) => {
      const next = new Set(prev);
      const lower = breachName.toLowerCase();
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });

    // Update local breach correlation view
    setBreaches((prev) =>
      prev.map((b) =>
        b.breachName.toLowerCase() === breachName.toLowerCase()
          ? {
              ...b,
              isRemediationConfirmed: !b.isRemediationConfirmed,
              isCurrentCompromiseLikely: false,
              riskExplanation: !b.isRemediationConfirmed
                ? "Remediation confirmed: You marked this breach as remediated."
                : "Unmitigated: Known breach records exist without user-confirmed credential rotation.",
            }
          : b
      )
    );
  };

  const toggleLockdownCheck = (
    stepId: string,
    field: "isPasswordChanged" | "isMfaChecked" | "isSessionsRevoked" | "isOAuthReviewed"
  ) => {
    setLockdownSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, [field]: !step[field], completedAt: new Date().toISOString() }
          : step
      )
    );
  };

  const filteredEvents = events.filter((ev) => {
    const matchesCategory =
      timelineCategoryFilter === "ALL" || ev.category === timelineCategoryFilter;
    const matchesSeverity =
      timelineSeverityFilter === "ALL" || ev.severity === timelineSeverityFilter;
    return matchesCategory && matchesSeverity;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
            <Shield size={13} aria-hidden />
            <span>Security Intelligence & Breach Correlation</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Cyber-Defense & Security Timeline
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Correlate multi-source data breaches with mailbox authentication alerts, unfamiliar devices, MFA modifications, and guided emergency lockdown.
          </p>
        </div>

        {/* Scan Button */}
        <div className="flex items-center gap-3">
          {session ? (
            <button
              type="button"
              onClick={startScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-500 disabled:opacity-50"
            >
              <Sparkles size={14} className={isScanning ? "animate-spin" : ""} aria-hidden />
              <span>{isScanning ? "Auditing Security…" : "Run Security Audit"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-500"
            >
              <span>Sign in to Audit</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Authentication Prompt ──────────────────────────────── */}
      {!session && status !== "loading" && (
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <ShieldAlert size={24} aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Sign in with Google for Security Intelligence
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-foreground/60">
            Our privacy-conscious engine audits security notification headers and snippets in volatile memory to correlate credential leaks, unfamiliar logins, and MFA modifications. Email bodies are never saved.
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-950/50 hover:bg-rose-500"
          >
            <span>Connect Gmail Account</span>
          </button>
        </div>
      )}

      {/* ── Progress Bar ───────────────────────────────────────── */}
      {isScanning && progress && (
        <div className="mb-8 rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-medium text-rose-300">
            <span className="flex items-center gap-2">
              <span className="size-2 animate-ping rounded-full bg-rose-400" />
              {progress.message}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-rose-950/60">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error Banner ───────────────────────────────────────── */}
      {error && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
          <div className="flex-1">
            <span className="font-semibold">Security Audit Error: </span>
            {error}
          </div>
        </div>
      )}

      {/* ── Navigation Tabs ────────────────────────────────────── */}
      {summary && (
        <div className="mb-8 border-b border-white/10">
          <div className="flex space-x-2 overflow-x-auto pb-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("OVERVIEW")}
              className={`rounded-lg px-3.5 py-2 transition-all ${
                activeTab === "OVERVIEW"
                  ? "bg-rose-500/20 text-rose-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              Overview & Risk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("TIMELINE")}
              className={`rounded-lg px-3.5 py-2 transition-all ${
                activeTab === "TIMELINE"
                  ? "bg-rose-500/20 text-rose-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              Event Timeline ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("BREACHES")}
              className={`rounded-lg px-3.5 py-2 transition-all ${
                activeTab === "BREACHES"
                  ? "bg-rose-500/20 text-rose-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              Breach Intelligence ({breaches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("DEVICES")}
              className={`rounded-lg px-3.5 py-2 transition-all ${
                activeTab === "DEVICES"
                  ? "bg-rose-500/20 text-rose-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              Devices & IPs ({summary.ipBreakdown.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("LOCKDOWN")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-all ${
                activeTab === "LOCKDOWN"
                  ? "bg-amber-500/20 text-amber-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Lock size={12} />
              <span>Emergency Lockdown</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Tab Contents ──────────────────────────────────── */}
      {summary && (
        <div className="space-y-8">
          {/* TAB 1: OVERVIEW & RISK */}
          {activeTab === "OVERVIEW" && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-foreground/50">
                    <span className="text-xs font-medium">Security Incidents</span>
                    <Activity size={16} className="text-rose-400" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                    {summary.totalSecurityEvents}
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/50">
                    Logins, password & MFA events detected
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-foreground/50">
                    <span className="text-xs font-medium">Breach Exposures</span>
                    <ShieldAlert size={16} className="text-amber-400" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                    {summary.breachesDetected}
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/50">
                    Correlated multi-source breach records
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-foreground/50">
                    <span className="text-xs font-medium">Unverified Events</span>
                    <Clock size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                    {summary.unverifiedEventsCount}
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/50">
                    Heuristic inferences pending corroboration
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-foreground/50">
                    <span className="text-xs font-medium">Critical Lockdown Accounts</span>
                    <Lock size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                    {summary.criticalLockdownItemsCount}
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/50">
                    Primary email & financial services to audit
                  </p>
                </div>
              </div>

              {/* Explainable Risk Gauge & Factor Breakdown */}
              {riskEvaluation && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            riskEvaluation.tier === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300"
                              : riskEvaluation.tier === "HIGH"
                              ? "bg-amber-500/20 text-amber-300"
                              : riskEvaluation.tier === "MEDIUM"
                              ? "bg-indigo-500/20 text-indigo-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {riskEvaluation.tier} TIER
                        </span>
                        <h2 className="text-base font-bold text-foreground">
                          Explainable Cyber Risk Score: {riskEvaluation.score} / 100
                        </h2>
                      </div>
                      <p className="mt-1.5 text-xs text-foreground/60 leading-relaxed">
                        {riskEvaluation.summaryExplanation}
                      </p>
                    </div>

                    <div className="shrink-0 text-right sm:text-right">
                      <div className="text-3xl font-extrabold tracking-tight text-foreground">
                        {riskEvaluation.score}
                        <span className="text-xs font-normal text-foreground/50">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Factor Breakdown */}
                  <div className="mt-6 border-t border-white/5 pt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                      Transparent Factor Breakdown
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {riskEvaluation.factors.map((factor) => (
                        <div
                          key={factor.id}
                          className="flex items-start justify-between rounded-lg border border-white/5 bg-black/40 p-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-foreground">{factor.title}</div>
                            <p className="mt-0.5 text-[11px] text-foreground/60">
                              {factor.description}
                            </p>
                          </div>
                          <div className="ml-3 shrink-0 font-mono font-bold text-rose-400">
                            +{factor.scoreContribution} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended High-Priority Actions */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Recommended Cyber-Defense Actions ({actionPlan.length})
                </h3>
                <div className="mt-4 space-y-3">
                  {actionPlan.slice(0, 5).map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start justify-between rounded-lg border border-white/5 bg-black/40 p-3.5 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              action.priority === "IMMEDIATE"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {action.priority}
                          </span>
                          <span className="font-semibold text-foreground">{action.label}</span>
                        </div>
                        <p className="text-[11px] text-foreground/60 leading-relaxed">
                          {action.description}
                        </p>
                      </div>

                      {action.actionUrl && (
                        <a
                          href={action.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 shrink-0 rounded bg-white/5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-white/10"
                        >
                          Direct Settings
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVENT TIMELINE */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-6">
              {/* Timeline Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-foreground/50" />
                  <span className="font-medium text-foreground/70">Category:</span>
                  <select
                    value={timelineCategoryFilter}
                    onChange={(e) => setTimelineCategoryFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="AUTHENTICATION">Authentication</option>
                    <option value="CREDENTIAL_CHANGE">Credential Changes</option>
                    <option value="MFA">Multi-Factor Auth</option>
                    <option value="DEVELOPER">Developer Security</option>
                    <option value="ACCOUNT_LEVEL">Account Level</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground/70">Severity:</span>
                  <select
                    value={timelineSeverityFilter}
                    onChange={(e) => setTimelineSeverityFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              {/* Chronological Event Cards */}
              {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground/50">
                  No security events found matching the active filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                ev.severity === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : ev.severity === "HIGH"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : ev.severity === "MEDIUM"
                                  ? "bg-indigo-500/20 text-indigo-300"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {ev.severity}
                            </span>
                            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                              {ev.category}
                            </span>
                            <span className="font-semibold text-xs text-foreground">
                              {ev.serviceName}: {ev.recommendedActionTitle}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-foreground/70 leading-relaxed">
                            {ev.recommendedActionDescription}
                          </p>
                        </div>

                        <div className="text-right text-[11px] text-foreground/50">
                          {ev.observedAt.slice(0, 10)}
                        </div>
                      </div>

                      {/* Event Metadata (Device, IP, Browser, Location) */}
                      {(ev.reportedDevice || ev.reportedIp || ev.reportedBrowser) && (
                        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/5 pt-3 text-[11px] text-foreground/60">
                          {ev.reportedDevice && (
                            <div className="flex items-center gap-1.5">
                              <Smartphone size={12} className="text-foreground/40" />
                              <span>{ev.reportedDevice}</span>
                            </div>
                          )}
                          {ev.reportedBrowser && (
                            <div className="flex items-center gap-1.5">
                              <Monitor size={12} className="text-foreground/40" />
                              <span>{ev.reportedBrowser}</span>
                            </div>
                          )}
                          {ev.reportedIp && (
                            <div className="flex items-center gap-1.5">
                              <Globe size={12} className="text-foreground/40" />
                              <span className="font-mono">{ev.reportedIp}</span>
                            </div>
                          )}
                          {ev.reportedLocation && (
                            <div className="text-foreground/40 italic">
                              ({ev.reportedLocation} — approximate)
                            </div>
                          )}

                          {ev.remediationUrl && (
                            <a
                              href={ev.remediationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300"
                            >
                              <span>Manage Security</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BREACH INTELLIGENCE */}
          {activeTab === "BREACHES" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-sm font-semibold text-foreground">
                  Correlated Data Breaches ({breaches.length})
                </h2>
                <p className="mt-1 text-xs text-foreground/60">
                  Breaches involving your email address discovered across public vulnerability registries. Historical breach records indicate data leaks that occurred in the past; they do not automatically imply active account takeover.
                </p>
              </div>

              {breaches.length === 0 ? (
                <div className="py-12 text-center text-xs text-foreground/50">
                  No data breaches recorded for your email address.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {breaches.map((b) => (
                    <div
                      key={b.breachName}
                      className={`flex flex-col justify-between rounded-xl border p-5 backdrop-blur-sm ${
                        b.isRemediationConfirmed
                          ? "border-emerald-500/20 bg-emerald-950/10"
                          : b.isCurrentCompromiseLikely
                          ? "border-rose-500/30 bg-rose-950/20"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">
                            {b.breachName}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              b.isRemediationConfirmed
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {b.isRemediationConfirmed ? "Remediated" : "Action Needed"}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-foreground/70 leading-relaxed">
                          {b.riskExplanation}
                        </p>

                        <div className="mt-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                            Exposed Data Classes:
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {b.exposedDataClasses.map((dc) => (
                              <span
                                key={dc}
                                className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-foreground/70"
                              >
                                {dc}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                        <button
                          type="button"
                          onClick={() => toggleBreachRemediation(b.breachName)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground"
                        >
                          <CheckCircle2
                            size={14}
                            className={b.isRemediationConfirmed ? "text-emerald-400" : "text-foreground/30"}
                          />
                          <span>
                            {b.isRemediationConfirmed ? "Verified Rotated" : "Mark as Rotated"}
                          </span>
                        </button>

                        <a
                          href={`https://${b.affectedDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300"
                        >
                          <span>Visit Service</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DEVICES & IPS */}
          {activeTab === "DEVICES" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h2 className="text-sm font-semibold text-foreground">
                  Device, Browser & IP Intelligence
                </h2>
                <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
                  Aggregated clients identified across your security notification emails. Note: IP-derived geolocation represents an approximate regional routing point and must never be interpreted as verified physical GPS coordinates.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Devices */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                    Detected Devices
                  </h3>
                  <div className="mt-4 space-y-2.5">
                    {summary.deviceBreakdown.length === 0 ? (
                      <p className="text-xs text-foreground/40">No devices parsed from alerts.</p>
                    ) : (
                      summary.deviceBreakdown.map((d) => (
                        <div
                          key={d.device}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 p-3 text-xs"
                        >
                          <span className="font-medium text-foreground">{d.device}</span>
                          <span className="font-semibold text-foreground/70">{d.count} events</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Browsers */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                    Detected Browsers
                  </h3>
                  <div className="mt-4 space-y-2.5">
                    {summary.browserBreakdown.length === 0 ? (
                      <p className="text-xs text-foreground/40">No browsers parsed from alerts.</p>
                    ) : (
                      summary.browserBreakdown.map((b) => (
                        <div
                          key={b.browser}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 p-3 text-xs"
                        >
                          <span className="font-medium text-foreground">{b.browser}</span>
                          <span className="font-semibold text-foreground/70">{b.count} events</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* IP Addresses */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Observed Remote IP Addresses
                </h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-foreground/50">
                        <th className="pb-3 font-medium">IP Address</th>
                        <th className="pb-3 font-medium">Reported Region</th>
                        <th className="pb-3 font-medium text-right">Occurrence Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {summary.ipBreakdown.map((ip) => (
                        <tr key={ip.ip}>
                          <td className="py-3 font-mono font-medium text-foreground">{ip.ip}</td>
                          <td className="py-3 text-foreground/70">
                            {ip.approximateLocation || "Unknown Regional Location"}
                            <span className="ml-1 text-[10px] text-foreground/40 italic">
                              (estimated)
                            </span>
                          </td>
                          <td className="py-3 text-right font-semibold text-foreground/80">
                            {ip.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EMERGENCY LOCKDOWN */}
          {activeTab === "LOCKDOWN" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-5">
                <div className="flex items-center gap-2 text-amber-400">
                  <Lock size={16} />
                  <h2 className="text-sm font-semibold tracking-tight">
                    Emergency Account Lockdown Workflow
                  </h2>
                </div>
                <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
                  In case of suspected credential theft, execute this prioritized lockdown sequence. Accounts are ordered by blast radius: primary identity providers first, followed by financial conduits, cloud backups, and developer infrastructure.
                </p>
              </div>

              <div className="space-y-4">
                {lockdownSteps.map((step) => {
                  const completedCount =
                    (step.isPasswordChanged ? 1 : 0) +
                    (step.isMfaChecked ? 1 : 0) +
                    (step.isSessionsRevoked ? 1 : 0) +
                    (step.isOAuthReviewed ? 1 : 0);

                  return (
                    <div
                      key={step.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              Tier {step.criticalityTier}: {step.category}
                            </span>
                            <h3 className="font-bold text-sm text-foreground">
                              {step.serviceName}
                            </h3>
                          </div>
                          <span className="text-[11px] text-foreground/50">{step.domain}</span>
                        </div>

                        {step.officialSecurityUrl && (
                          <a
                            href={step.officialSecurityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-white/10"
                          >
                            <span>Open Official Security Portal</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>

                      {/* 4 Interactive Checklist Steps */}
                      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-black/40 p-3 text-xs">
                          <input
                            type="checkbox"
                            checked={step.isPasswordChanged}
                            onChange={() => toggleLockdownCheck(step.id, "isPasswordChanged")}
                            className="rounded border-white/20 text-emerald-500"
                          />
                          <span className={step.isPasswordChanged ? "line-through text-foreground/40" : "text-foreground"}>
                            Password Rotated
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-black/40 p-3 text-xs">
                          <input
                            type="checkbox"
                            checked={step.isMfaChecked}
                            onChange={() => toggleLockdownCheck(step.id, "isMfaChecked")}
                            className="rounded border-white/20 text-emerald-500"
                          />
                          <span className={step.isMfaChecked ? "line-through text-foreground/40" : "text-foreground"}>
                            MFA Verified
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-black/40 p-3 text-xs">
                          <input
                            type="checkbox"
                            checked={step.isSessionsRevoked}
                            onChange={() => toggleLockdownCheck(step.id, "isSessionsRevoked")}
                            className="rounded border-white/20 text-emerald-500"
                          />
                          <span className={step.isSessionsRevoked ? "line-through text-foreground/40" : "text-foreground"}>
                            Sessions Revoked
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-black/40 p-3 text-xs">
                          <input
                            type="checkbox"
                            checked={step.isOAuthReviewed}
                            onChange={() => toggleLockdownCheck(step.id, "isOAuthReviewed")}
                            className="rounded border-white/20 text-emerald-500"
                          />
                          <span className={step.isOAuthReviewed ? "line-through text-foreground/40" : "text-foreground"}>
                            OAuth Reviewed
                          </span>
                        </label>
                      </div>

                      {completedCount === 4 && (
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 size={13} />
                          <span>All lockdown actions verified for this platform.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
