"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  ShieldCheck,
  EyeOff,
  Mail,
  FileText,
  Trash2,
  Lock,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Clock,
  Send,
  Building,
  RefreshCw,
} from "lucide-react";
import {
  type UnsubscribeCandidate,
  type EmailTrackerDetection,
  type OAuthAppRecord,
  type DataBrokerRecord,
  type CleanupAccountRecord,
  type LegalErasureTrackedRequest,
  type PrivacyIntelligenceSummary,
  type LegalRegulation,
  type CleanupAccountStatus,
} from "@/lib/intelligence/privacy/privacyTypes";
import { VERIFIED_DATA_BROKERS } from "@/lib/intelligence/privacy/data-brokers/brokerRegistry";
import { LegalDeadlineCalculator } from "@/lib/intelligence/privacy/legal/legalDeadlineCalculator";
import { LegalTemplateGenerator } from "@/lib/intelligence/privacy/legal/legalTemplateGenerator";
import { CleanupStateMachine } from "@/lib/intelligence/privacy/cleanup/cleanupStateMachine";
import { consumeNdjsonStream } from "@/lib/ndjsonStream";

interface ScanProgress {
  stage: number;
  percent: number;
  message: string;
}

export function PrivacyDashboard() {
  const { data: session, status } = useSession();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "UNSUBSCRIBE" | "OAUTH" | "BROKERS" | "LEGAL" | "CLEANUP" | "INSPECTOR"
  >("OVERVIEW");

  // State data
  const [summary, setSummary] = useState<PrivacyIntelligenceSummary | null>(null);
  const [unsubCandidates, setUnsubCandidates] = useState<UnsubscribeCandidate[]>([]);
  const [trackers, setTrackers] = useState<EmailTrackerDetection[]>([]);
  const [oauthApps, setOauthApps] = useState<OAuthAppRecord[]>([]);
  const [dataBrokers, setDataBrokers] = useState<DataBrokerRecord[]>(VERIFIED_DATA_BROKERS);
  const [cleanupAccounts, setCleanupAccounts] = useState<CleanupAccountRecord[]>([]);
  const [legalRequests, setLegalRequests] = useState<LegalErasureTrackedRequest[]>([]);

  // Unsubscribe execution state
  const [executingUnsubId, setExecutingUnsubId] = useState<string | null>(null);
  const [unsubMessage, setUnsubMessage] = useState<{ id: string; success: boolean; text: string } | null>(null);

  // Broker filter state
  const [brokerCategoryFilter, setBrokerCategoryFilter] = useState<string>("ALL");
  const [brokerDropOnly, setBrokerDropOnly] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState("");

  // Legal template generator modal state
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [targetServiceName, setTargetServiceName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [selectedRegulation, setSelectedRegulation] = useState<LegalRegulation>("GDPR_EU");
  const [generatedNotice, setGeneratedNotice] = useState<ReturnType<typeof LegalTemplateGenerator.generateNotice> | null>(null);

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setProgress({ stage: 1, percent: 10, message: "Initiating Privacy Intelligence scan…" });

    try {
      const response = await fetch("/api/privacy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalRequests }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Google session expired or authorization was revoked. Please sign in again.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Scan request failed with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response stream received from privacy endpoint.");
      }

      await consumeNdjsonStream(
        response.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          if (data.type === "progress") {
            setProgress({
              stage: data.stage || 1,
              percent: data.percent || 20,
              message: data.message || "Auditing privacy records…",
            });
          } else if (data.type === "result" && data.analysis) {
            setSummary(data.analysis.summary);
            setUnsubCandidates(data.analysis.unsubscribeCandidates || []);
            setTrackers(data.analysis.trackerDetections || []);
            setOauthApps(data.analysis.oauthApps || []);
            setDataBrokers(data.analysis.dataBrokers || VERIFIED_DATA_BROKERS);
            setCleanupAccounts(data.analysis.cleanupAccounts || []);
            setLegalRequests(data.analysis.legalRequests || []);
          } else if (data.type === "error") {
            throw new Error(data.error || "An error occurred during scanning.");
          }
        }
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleExecuteUnsubscribe = async (candidate: UnsubscribeCandidate) => {
    setExecutingUnsubId(candidate.id);
    setUnsubMessage(null);

    try {
      const res = await fetch("/api/privacy/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate,
          confirmedByUser: true,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setUnsubMessage({
          id: candidate.id,
          success: true,
          text: json.message || "Successfully unsubscribed via RFC 8058 One-Click.",
        });

        // Update local status
        setUnsubCandidates((prev) =>
          prev.map((c) =>
            c.id === candidate.id ? { ...c, status: "SUCCESS" } : c
          )
        );
      } else {
        setUnsubMessage({
          id: candidate.id,
          success: false,
          text: json.message || json.error || "Unsubscribe request failed.",
        });
      }
    } catch (err) {
      setUnsubMessage({
        id: candidate.id,
        success: false,
        text: (err as Error).message,
      });
    } finally {
      setExecutingUnsubId(null);
    }
  };

  const handleCleanupTransition = (record: CleanupAccountRecord, toStatus: CleanupAccountStatus) => {
    try {
      const updated = CleanupStateMachine.transitionAccount(record, toStatus, `User updated status in Privacy Dashboard`);
      setCleanupAccounts((prev) => prev.map((a) => (a.id === record.id ? updated : a)));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const openLegalGenerator = (domain = "", serviceName = "") => {
    setTargetDomain(domain);
    setTargetServiceName(serviceName || domain);
    const notice = LegalTemplateGenerator.generateNotice({
      serviceName: serviceName || domain || "Service Provider",
      senderDomain: domain || "example.com",
      userEmail: session?.user?.email || "user@example.com",
      regulation: selectedRegulation,
    });
    setGeneratedNotice(notice);
    setShowLegalModal(true);
  };

  const updateNoticeRegulation = (reg: LegalRegulation) => {
    setSelectedRegulation(reg);
    const notice = LegalTemplateGenerator.generateNotice({
      serviceName: targetServiceName || targetDomain || "Service Provider",
      senderDomain: targetDomain || "example.com",
      userEmail: session?.user?.email || "user@example.com",
      regulation: reg,
    });
    setGeneratedNotice(notice);
  };

  const saveTrackedLegalRequest = () => {
    if (!generatedNotice) return;
    const tracked = LegalDeadlineCalculator.createTrackedRequest({
      userId: session?.user?.email || "user",
      targetDomain: targetDomain || "example.com",
      serviceName: targetServiceName || targetDomain || "Service",
      regulation: selectedRegulation,
      contactEmail: generatedNotice.recipientEmail,
    });

    setLegalRequests((prev) => [tracked, ...prev]);
    setShowLegalModal(false);
  };

  // Filtered brokers
  const filteredBrokers = dataBrokers.filter((b) => {
    if (brokerCategoryFilter !== "ALL" && b.category !== brokerCategoryFilter) return false;
    if (brokerDropOnly && !b.californiaDropEligible) return false;
    if (brokerSearch) {
      const q = brokerSearch.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.instructions.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              Privacy Defense & Deletion Engine
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Privacy Management & Footprint Control
          </h1>
          <p className="mt-1 text-xs text-foreground/60 max-w-2xl">
            Audit marketing subscriptions, execute RFC 8058 one-click unsubscribes without tracking beacons,
            track statutory erasure deadlines (GDPR, CCPA, DPDP), and coordinate data broker opt-outs with California DROP.
          </p>
        </div>

        {/* Scan Button */}
        <div>
          {status === "authenticated" ? (
            <button
              type="button"
              onClick={startScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs text-black shadow-lg transition-all disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
            >
              {isScanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Scanning Privacy Telemetry…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Run Privacy Scan</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/privacy" })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs text-black shadow-lg transition-all"
              style={{ background: "var(--color-accent)" }}
            >
              <Lock size={14} />
              <span>Connect Mailbox to Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isScanning && progress && (
        <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/40">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-medium text-foreground/80">{progress.message}</span>
            <span className="font-mono text-foreground/60">{progress.percent}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress.percent}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {[
          { key: "OVERVIEW", label: "Overview", icon: ShieldCheck },
          { key: "UNSUBSCRIBE", label: `Unsubscribe Radar (${unsubCandidates.length})`, icon: Mail },
          { key: "OAUTH", label: `OAuth Center (${oauthApps.length})`, icon: Lock },
          { key: "BROKERS", label: `Data Brokers (${dataBrokers.length})`, icon: Building },
          { key: "LEGAL", label: `Legal Erasure (${legalRequests.length})`, icon: FileText },
          { key: "CLEANUP", label: `Account Cleanup (${cleanupAccounts.length})`, icon: Trash2 },
          { key: "INSPECTOR", label: `Email Telemetry (${trackers.length})`, icon: EyeOff },
        ].map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-foreground font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon size={14} style={{ color: isActive ? "var(--color-accent)" : undefined }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === "OVERVIEW" && (
        <div className="mt-6 space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-medium text-foreground/60">Privacy Health Score</div>
              <div className="mt-2 text-3xl font-bold" style={{ color: "var(--color-accent)" }}>
                {summary?.privacyHealthScore ?? 85}
                <span className="text-xs text-foreground/40 font-normal"> / 100</span>
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">Calculated from dormant accounts & tracking telemetry</p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-medium text-foreground/60">One-Click Lists</div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {summary?.rfc8058EligibleCount ?? unsubCandidates.filter((c) => c.mechanism === "RFC_8058_POST").length}
                <span className="text-xs text-foreground/40 font-normal"> / {unsubCandidates.length} total</span>
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">RFC 8058 compliant HTTPS POST one-click unsubscribe</p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-medium text-foreground/60">Trackers Detected</div>
              <div className="mt-2 text-3xl font-bold text-amber-400">
                {summary?.totalTrackersDetected ?? trackers.reduce((acc, t) => acc + t.trackingPixels.length, 0)}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">1x1 tracking pixels & telemetry link wrappers</p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] font-medium text-foreground/60">Active Legal Requests</div>
              <div className="mt-2 text-3xl font-bold text-sky-400">
                {legalRequests.length}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">Statutory GDPR / CCPA / DPDP erasure trackers</p>
            </div>
          </div>

          {/* Quick Action Callout */}
          <div className="p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-blue-950/20 to-purple-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building size={16} style={{ color: "var(--color-accent)" }} />
                California DROP: Automated Bulk Data Broker Removal
              </h2>
              <p className="mt-1 text-xs text-foreground/60 max-w-2xl">
                Under the California Delete Act (SB 362), consumers can submit a single deletion request at{" "}
                <span className="text-foreground font-mono">privacy.ca.gov/DROP</span> that legally mandates all registered data brokers to purge records every 45 days.
              </p>
            </div>
            <a
              href="https://privacy.ca.gov/DROP"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-foreground transition-all shrink-0"
            >
              <span>Visit Official Portal</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {/* Action Center Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                <Mail size={14} style={{ color: "var(--color-accent)" }} />
                Recent Mailing Lists Eligible for 1-Click Unsubscribe
              </h3>
              <div className="mt-3 divide-y divide-white/5">
                {unsubCandidates.slice(0, 4).map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-foreground">{c.senderName}</div>
                      <div className="text-[10px] text-foreground/50">{c.domain} · {c.mechanism}</div>
                    </div>
                    {c.mechanism === "RFC_8058_POST" ? (
                      <button
                        type="button"
                        onClick={() => handleExecuteUnsubscribe(c)}
                        disabled={executingUnsubId === c.id}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-foreground transition-all disabled:opacity-50"
                      >
                        {executingUnsubId === c.id ? "Unsubscribing…" : "1-Click Unsub"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-foreground/40 font-mono">Web link only</span>
                    )}
                  </div>
                ))}
                {unsubCandidates.length === 0 && (
                  <p className="text-xs text-foreground/40 py-4 text-center">Run a privacy scan to populate mailing lists.</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                <Trash2 size={14} style={{ color: "var(--color-accent)" }} />
                Dormant Account Cleanup Targets
              </h3>
              <div className="mt-3 divide-y divide-white/5">
                {cleanupAccounts.slice(0, 4).map((acc) => (
                  <div key={acc.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-foreground">{acc.serviceName}</div>
                      <div className="text-[10px] text-foreground/50">
                        {acc.domain} · {acc.deletionDifficulty} difficulty · {acc.daysInactive}d inactive
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openLegalGenerator(acc.domain, acc.serviceName)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-white/10 hover:bg-white/5 text-foreground/80 transition-all"
                    >
                      Draft Erasure
                    </button>
                  </div>
                ))}
                {cleanupAccounts.length === 0 && (
                  <p className="text-xs text-foreground/40 py-4 text-center">No dormant accounts identified yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: UNSUBSCRIBE_RADAR */}
      {activeTab === "UNSUBSCRIBE" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Discovered Mailing Lists & Unsubscribe Endpoints</h2>
            <span className="text-xs text-foreground/50">{unsubCandidates.length} senders found</span>
          </div>

          {unsubMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center justify-between ${
                unsubMessage.success ? "bg-emerald-950/20 border border-emerald-500/20 text-emerald-400" : "bg-red-950/20 border border-red-500/20 text-red-400"
              }`}
            >
              <span>{unsubMessage.text}</span>
              <button type="button" onClick={() => setUnsubMessage(null)} className="font-bold ml-2">×</button>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-foreground/60 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Sender / Domain</th>
                  <th className="p-3">Mechanism</th>
                  <th className="p-3">Frequency</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {unsubCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{c.senderName}</div>
                      <div className="text-[10px] text-foreground/50">{c.senderEmail}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          c.mechanism === "RFC_8058_POST"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : c.mechanism === "MAILTO"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-white/5 text-foreground/60"
                        }`}
                      >
                        {c.mechanism}
                      </span>
                    </td>
                    <td className="p-3 text-foreground/70">{c.frequencyRating} ({c.emailCount} msgs)</td>
                    <td className="p-3">
                      <span className="text-[11px] text-foreground/60 font-mono">{c.status}</span>
                    </td>
                    <td className="p-3 text-right">
                      {c.mechanism === "RFC_8058_POST" ? (
                        <button
                          type="button"
                          onClick={() => handleExecuteUnsubscribe(c)}
                          disabled={executingUnsubId === c.id || c.status === "SUCCESS"}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-50"
                        >
                          {c.status === "SUCCESS" ? "Unsubscribed" : executingUnsubId === c.id ? "Executing…" : "One-Click POST"}
                        </button>
                      ) : c.mechanism === "MAILTO" ? (
                        <a
                          href={`mailto:${c.mailtoAddress}?subject=${encodeURIComponent(c.mailSubject ?? "Unsubscribe")}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all"
                        >
                          <Send size={11} />
                          <span>Mailto</span>
                        </a>
                      ) : (
                        <a
                          href={c.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-foreground/80 transition-all"
                        >
                          <span>Web Page</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {unsubCandidates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-foreground/40">
                      No mailing lists loaded. Click &quot;Run Privacy Scan&quot; to inspect your inbox headers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: OAUTH_CENTER */}
      {activeTab === "OAUTH" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Third-Party OAuth Authorizations & Permissions</h2>
              <p className="text-xs text-foreground/60">
                Audited third-party applications with tokenized access to your primary platforms.
              </p>
            </div>
            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-foreground transition-all"
            >
              <span>Google Connected Apps</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {oauthApps.map((app) => (
              <div key={app.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{app.appName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        app.riskRating === "CRITICAL"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : app.riskRating === "HIGH"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "bg-white/10 text-foreground/70"
                      }`}
                    >
                      {app.riskRating} RISK
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-foreground/50">Provider: {app.provider}</div>
                  <p className="mt-2 text-xs text-foreground/70">{app.notes || "Third-party application integration."}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.scopes.map((s, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px] text-foreground/60">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                  <a
                    href={app.managementUrl || "https://myaccount.google.com/connections"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-foreground/80 hover:text-foreground font-semibold"
                  >
                    <span>Manage on {app.provider}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
            {oauthApps.length === 0 && (
              <div className="col-span-2 p-8 text-center text-foreground/40 border border-white/10 rounded-xl bg-white/[0.01]">
                No third-party OAuth app alerts detected in mailbox notices. You can manually inspect your permissions via the provider links above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: DATA_BROKERS */}
      {activeTab === "BROKERS" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Verified Data Broker Registry</h2>
              <p className="text-xs text-foreground/60">
                Verified against California CPPA and Vermont SOS registries. (Epistemic clarity: profiles are inferred based on industry aggregation practices).
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search brokers…"
                value={brokerSearch}
                onChange={(e) => setBrokerSearch(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-black/40 text-foreground placeholder:text-foreground/40 focus:outline-none"
              />
              <select
                value={brokerCategoryFilter}
                onChange={(e) => setBrokerCategoryFilter(e.target.value)}
                aria-label="Filter brokers by category"
                className="px-2 py-1 text-xs rounded-lg border border-white/10 bg-black/40 text-foreground focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="PEOPLE_SEARCH">People Search</option>
                <option value="MARKETING_ADVERTISING">Marketing & Ad Tech</option>
                <option value="FINANCIAL_CREDIT">Financial & Credit</option>
                <option value="RISK_FRAUD">Risk & Identity</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-foreground/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={brokerDropOnly}
                  onChange={(e) => setBrokerDropOnly(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                <span>California DROP Mandated</span>
              </label>
            </div>
          </div>

          {/* Broker Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrokers.map((broker) => (
              <div key={broker.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-foreground">{broker.name}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-foreground/60">
                      {broker.category.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground/70 leading-relaxed">{broker.instructions}</p>

                  <div className="mt-3 flex items-center gap-2 text-[10px] text-foreground/50">
                    <span>Difficulty: <strong className="text-foreground/80">{broker.deletionDifficulty}</strong></span>
                    <span>·</span>
                    <span>Method: {broker.optOutMethod}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  {broker.californiaDropEligible && (
                    <span className="text-[10px] font-semibold text-sky-400">CA DROP Eligible</span>
                  )}
                  <a
                    href={broker.optOutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-xs font-semibold text-foreground/80 hover:text-foreground"
                  >
                    <span>Opt-Out Form</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: LEGAL_REQUESTS */}
      {activeTab === "LEGAL" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Statutory Erasure Request Tracker</h2>
              <p className="text-xs text-foreground/60">
                Track formal statutory deadlines under GDPR Art 17 (30d), CCPA § 1798.105 (45d), and India DPDP 2023.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openLegalGenerator()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black"
              style={{ background: "var(--color-accent)" }}
            >
              <FileText size={13} />
              <span>Draft New Legal Erasure Notice</span>
            </button>
          </div>

          {/* Statutory Note on DPDP */}
          <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/20 text-xs text-sky-200">
            <strong>Statutory Enforcement Advisory (India DPDP Act 2023):</strong> Section 12 commencement is scheduled for <strong>May 13, 2027</strong> under Central Government Notification S.O. 4930(E). Notices dispatched before this appointed date operate as voluntary/informational privacy demands.
          </div>

          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
            {legalRequests.map((req) => {
              const deadlines = LegalDeadlineCalculator.calculateDeadlines(req);
              return (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{req.serviceName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-foreground/70">
                        {req.regulation}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : req.status === "OVERDUE"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-foreground/50">
                      Dispatched: {req.requestDate.slice(0, 10)} · Contact: {req.contactEmail}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-semibold">
                      {deadlines.daysRemaining > 0 ? (
                        <span className="text-foreground">{deadlines.daysRemaining} days remaining</span>
                      ) : (
                        <span className="text-red-400">OVERDUE</span>
                      )}
                    </div>
                    <div className="text-[10px] text-foreground/40 font-mono">
                      Deadline: {deadlines.effectiveDeadlineDate.slice(0, 10)}
                    </div>
                  </div>
                </div>
              );
            })}
            {legalRequests.length === 0 && (
              <div className="p-8 text-center text-foreground/40 text-xs">
                No active erasure requests tracked. Click &quot;Draft New Legal Erasure Notice&quot; to generate an enforceable demand.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: ACCOUNT_CLEANUP */}
      {activeTab === "CLEANUP" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Account Cleanup State Machine</h2>
              <p className="text-xs text-foreground/60">
                Manage account lifecycle states: Discovered → Under Review → Planned → Deletion Requested → Confirmed.
              </p>
            </div>
            <span className="text-xs text-foreground/50">{cleanupAccounts.length} accounts</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-foreground/60 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Platform</th>
                  <th className="p-3">Inactivity</th>
                  <th className="p-3">Difficulty</th>
                  <th className="p-3">Lifecycle State</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cleanupAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-white/[0.02]">
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{acc.serviceName}</div>
                      <div className="text-[10px] text-foreground/50">{acc.domain}</div>
                    </td>
                    <td className="p-3 text-foreground/70">{acc.daysInactive} days ago</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          acc.deletionDifficulty === "EASY"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : acc.deletionDifficulty === "MODERATE"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {acc.deletionDifficulty}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-foreground/80">
                        {acc.status}
                      </span>
                    </td>
                    <td className="p-3 text-right flex items-center justify-end gap-2">
                      {acc.deleteUrl && (
                        <a
                          href={acc.deleteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded text-[11px] font-medium bg-white/10 hover:bg-white/20 text-foreground flex items-center gap-1"
                        >
                          <span>Delete Link</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {acc.status === "DISCOVERED" && (
                        <button
                          type="button"
                          onClick={() => handleCleanupTransition(acc, "CLEANUP_PLANNED")}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        >
                          Plan Cleanup
                        </button>
                      )}
                      {acc.status === "CLEANUP_PLANNED" && (
                        <button
                          type="button"
                          onClick={() => handleCleanupTransition(acc, "DELETION_REQUESTED")}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                        >
                          Mark Requested
                        </button>
                      )}
                      {acc.status === "DELETION_REQUESTED" && (
                        <button
                          type="button"
                          onClick={() => handleCleanupTransition(acc, "DELETION_CONFIRMED")}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                        >
                          Confirm Deleted
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {cleanupAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-foreground/40">
                      No discovered accounts yet. Run a scan to discover linked platforms.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: EMAIL_INSPECTOR */}
      {activeTab === "INSPECTOR" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Email Privacy Inspector (Zero Remote Fetch)</h2>
              <p className="text-xs text-foreground/60">
                Detects 1x1 tracking pixels, hidden beacons, and click-wrapping telemetry without loading images or exposing your IP.
              </p>
            </div>
            <span className="text-xs text-foreground/50">{trackers.length} senders analyzed</span>
          </div>

          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
            {trackers.map((t) => (
              <div key={t.messageId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-foreground">{t.senderDomain}</div>
                  <span className="text-[10px] text-foreground/40 font-mono">{t.receivedAt.slice(0, 10)}</span>
                </div>
                <div className="mt-1 text-xs text-foreground/70 italic">&quot;{t.subject}&quot;</div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  {t.trackingPixels.map((p, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pixel: {p.trackerName} {p.isZeroSize ? "(1x1 hidden)" : ""}
                    </span>
                  ))}
                  {t.redirectUrls.map((r, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Redirect: {r.redirectDomain}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {trackers.length === 0 && (
              <div className="p-8 text-center text-foreground/40 text-xs">
                No tracking telemetry detected yet. Run a privacy scan to inspect incoming message headers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Legal Notice Generator */}
      {showLegalModal && generatedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-2xl w-full bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-foreground">Generate Statutory Erasure Notice</h3>
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="text-foreground/40 hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Regulation Selector */}
            <div className="flex flex-wrap gap-2">
              {(["GDPR_EU", "UK_GDPR", "CCPA_US", "DPDP_INDIA"] as LegalRegulation[]).map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => updateNoticeRegulation(reg)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedRegulation === reg
                      ? "bg-white text-black"
                      : "bg-white/5 text-foreground/70 hover:bg-white/10"
                  }`}
                >
                  {reg.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-foreground/60">
                <span>Recipient Contact:</span>
                <span className="font-mono text-foreground">{generatedNotice.recipientEmail}</span>
              </div>
              <div className="flex justify-between text-foreground/60">
                <span>Statutory Deadline:</span>
                <span className="font-mono text-foreground">{generatedNotice.deadlineDays} Days</span>
              </div>
            </div>

            {/* Body Preview */}
            <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] text-foreground/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {generatedNotice.body}
            </div>

            <p className="text-[10px] text-foreground/40 leading-relaxed italic">
              {generatedNotice.disclaimer}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <a
                href={generatedNotice.mailtoUrl}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-foreground transition-all flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Open in Mail Client</span>
              </a>
              <button
                type="button"
                onClick={saveTrackedLegalRequest}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-black transition-all flex items-center gap-1.5"
                style={{ background: "var(--color-accent)" }}
              >
                <Clock size={13} />
                <span>Save to Active Trackers</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
