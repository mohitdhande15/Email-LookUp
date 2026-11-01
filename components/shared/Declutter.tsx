"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Inbox,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Sparkles,
  Download,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Info,
  Lock,
  Mail,
  Filter,
  Bookmark,
  BookmarkCheck,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type LegalErasureRegulation } from "@/lib/legalErasure";
import { buildSanitizedCsv } from "@/lib/csvSanitizer";
import { AppStorage } from "@/lib/persistence/storage";
import { LegalErasureModal } from "@/components/declutter/LegalErasureModal";

export type DeclutterStatus = "Recent email" | "No email 90+ days" | "No email 1+ year";

export interface DeclutterPlatform {
  id: string;
  displayName: string;
  senderDisplayName: string | null;
  domain: string;
  type: "account" | "newsletter" | "unknown";
  reason: string;
  firstSeen: string;
  lastSeen: string;
  lastSeenFormatted: string;
  lastAnyEmail?: string;
  lastAnyEmailFormatted?: string;
  lastAnyDaysAgo?: number;
  lastActivityEmail?: string | null;
  lastActivityEmailFormatted?: string | null;
  lastActivityDaysAgo?: number | null;
  statusBasis?: "activity" | "any";
  daysAgo: number;
  emailCount: number;
  signupLike: boolean;
  status: DeclutterStatus;
  deleteUrl: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  riskReasons: string[];
  recommendedAction: string;
  breachStatus: "unmitigated" | "unverified_remediation" | "mitigated" | "none";
  breachDate?: string | null;
  lastSecurityEmailDate?: string | null;
}

const NOTIFICATION_ONLY_DOMAINS = new Set([
  "github.com",
  "pinterest.com",
  "discord.com",
  "notion.so",
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "reddit.com",
]);

/**
 * Accessible per-row confidence note tooltip for low-frequency senders.
 */
function ConfidenceTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-expanded={open}
        aria-label="This platform rarely emails, so this may not reflect real usage."
        title="This platform rarely emails, so this may not reflect real usage."
        className="p-0.5 rounded text-foreground/40 hover:text-foreground/80 focus:text-foreground transition-colors cursor-pointer inline-flex items-center"
      >
        <Info size={12} aria-hidden />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 bottom-full mb-1.5 z-40 w-56 p-2 rounded-lg text-[11px] leading-snug shadow-xl border bg-[#171717] text-foreground/90 border-white/10 pointer-events-none"
        >
          This platform rarely emails, so this may not reflect real usage.
        </div>
      )}
    </div>
  );
}

function getStatusStyles(status: DeclutterStatus) {
  if (status === "Recent email") {
    return {
      bg: "color-mix(in oklch, white 8%, transparent)",
      color: "var(--color-foreground)",
      dot: "rgba(255, 255, 255, 0.6)",
    };
  }
  if (status === "No email 90+ days") {
    return {
      bg: "color-mix(in oklch, #f59e0b 14%, transparent)",
      color: "#fbbf24",
      dot: "#f59e0b",
    };
  }
  return {
    bg: "color-mix(in oklch, white 6%, transparent)",
    color: "rgba(255, 255, 255, 0.55)",
    dot: "rgba(255, 255, 255, 0.4)",
  };
}

/**
 * Accessible "Why?" tooltip / popover that supports keyboard focus (Enter/Space/Tab)
 * and touch devices (tap to toggle).
 */
function WhyTooltip({ reason, type }: { reason: string; type: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-expanded={open}
        aria-label={`Why classified as ${type}: ${reason}`}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono text-foreground/50 hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-white/10"
        title={reason}
      >
        <HelpCircle size={10} aria-hidden />
        <span>Why?</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-1.5 z-50 w-52 p-2.5 rounded-xl shadow-xl text-xs backdrop-blur-md border pointer-events-auto"
            style={{
              background: "color-mix(in oklch, #18181b 92%, black)",
              borderColor: "color-mix(in oklch, white 15%, transparent)",
              color: "var(--color-foreground)",
            }}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 font-semibold">
                Classification Reason
              </span>
              <p className="text-xs text-foreground/90 leading-snug font-medium">
                {reason}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TemporalBreachBadge({ platform }: { platform: DeclutterPlatform }) {
  if (platform.breachStatus === "none") return null;

  const status = platform.breachStatus;
  const isMitigated = status === "mitigated";
  const isUnverified = status === "unverified_remediation";

  let label = "Unmitigated Breach";
  let style = {
    color: "#fca5a5",
    background: "color-mix(in oklch, #ef4444 14%, transparent)",
    borderColor: "color-mix(in oklch, #ef4444 32%, transparent)",
  };

  if (isMitigated) {
    label = "Breach Mitigated (Verified)";
    style = {
      color: "#34d399",
      background: "color-mix(in oklch, #10b981 14%, transparent)",
      borderColor: "color-mix(in oklch, #10b981 32%, transparent)",
    };
  } else if (isUnverified) {
    label = "Remediation Signal (Unverified)";
    style = {
      color: "#fcd34d",
      background: "color-mix(in oklch, #f59e0b 14%, transparent)",
      borderColor: "color-mix(in oklch, #f59e0b 32%, transparent)",
    };
  }

  const detail = isMitigated
    ? `User-verified remediation: Password rotated and MFA configured`
    : isUnverified
    ? `Security activity detected on ${platform.lastSecurityEmailDate}, but password rotation and 2FA require confirmation.`
    : `Breach: ${platform.breachDate ?? "historical"} · No subsequent security activity detected`;

  return (
    <span
      title={detail}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono border whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  );
}

export function Declutter() {
  const { data: session, status: authStatus } = useSession();
  const [avatarError, setAvatarError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{
    scanned: number;
    total: number;
    message: string;
  } | null>(null);
  const [platforms, setPlatforms] = useState<DeclutterPlatform[] | null>(null);
  const [summary, setSummary] = useState<{
    totalAccounts: number;
    over90Accounts?: number;
    inactiveAccounts?: number;
    totalPlatforms: number;
    scannedEmails: number;
    overallRiskScore?: number;
    highRiskAccounts?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters: default is "Accounts only"
  const [accountsOnly, setAccountsOnly] = useState(true);
  const [recencyFilter, setRecencyFilter] = useState<"all" | "no-email-90" | "no-email-1y">("all");

  // Client-side 'Still using' state: Set of platform IDs marked as still used (persisted via AppStorage)
  const [stillUsingIds, setStillUsingIds] = useState<Set<string>>(() =>
    AppStorage.getStillUsingIds()
  );
  const [legalPlatform, setLegalPlatform] = useState<DeclutterPlatform | null>(null);
  const [legalRegulation, setLegalRegulation] = useState<LegalErasureRegulation>("COMBINED");

  function toggleStillUsing(id: string) {
    setStillUsingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      AppStorage.saveStillUsingIds(next);
      return next;
    });
  }

  async function handleScan() {
    setError(null);
    setPlatforms(null);
    setSummary(null);
    setStillUsingIds(new Set());
    setScanning(true);
    setProgress({
      scanned: 0,
      total: 0,
      message: "Connecting to Gmail API…",
    });

    try {
      const res = await fetch("/api/declutter", {
        method: "POST",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Authentication required. Please sign in with Google.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Scan failed with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response stream received.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "progress") {
              setProgress({
                scanned: data.scanned ?? 0,
                total: data.total ?? 0,
                message: data.message ?? "Scanning…",
              });
            } else if (data.type === "done") {
              const platformList = data.platforms ?? [];
              setPlatforms(platformList);
              const summaryData =
                data.summary ?? {
                  totalAccounts: 0,
                  inactiveAccounts: 0,
                  totalPlatforms: 0,
                  scannedEmails: 0,
                };
              setSummary(summaryData);
              setScanning(false);

              // Persist scan history locally for audit and analytics
              if (session?.user?.email && summaryData) {
                AppStorage.recordScan({
                  userEmail: session.user.email,
                  totalPlatforms: summaryData.totalPlatforms ?? 0,
                  totalAccounts: summaryData.totalAccounts ?? 0,
                  inactiveAccounts: summaryData.inactiveAccounts ?? 0,
                  highRiskAccounts: summaryData.highRiskAccounts ?? 0,
                  overallRiskScore: summaryData.overallRiskScore ?? 0,
                });
              }
            } else if (data.type === "error") {
              setError(data.error ?? "An error occurred during scanning.");
              setScanning(false);
            }
          } catch {
            // Ignore malformed streaming chunk
          }
        }
      }
    } catch (err) {
      setError((err as Error).message ?? "Network error during scan.");
      setScanning(false);
    }
  }

  function handleDownloadCsv() {
    if (!platforms || platforms.length === 0) return;

    const headers = [
      "Platform",
      "Domain",
      "Type",
      "Classification Reason",
      "Sender Info",
      "Status",
      "Status Basis",
      "Still using",
      "Last Email",
      "Last Activity Email",
      "Days Ago",
      "Email Count",
      "Signup Detected",
      "Action Link",
      "Risk Score",
      "Risk Level",
      "Breach Status",
    ];

    const rows = platforms.map((p) => [
      p.displayName,
      p.domain,
      p.type,
      p.reason,
      p.senderDisplayName ?? "",
      p.status,
      p.statusBasis === "activity" ? "Activity email" : "Based on any email",
      stillUsingIds.has(p.id) ? "Yes" : "No",
      p.lastAnyEmailFormatted ?? p.lastSeenFormatted,
      p.lastActivityEmailFormatted ?? "None detected",
      p.daysAgo,
      p.emailCount,
      p.signupLike ? "Yes" : "No",
      p.deleteUrl,
      p.riskScore,
      p.riskLevel,
      p.breachStatus,
    ]);

    const csvString = buildSanitizedCsv(headers, rows);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `declutter-platforms-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Filtered platforms:
  // 1. accountsOnly toggle: default true (only "account" rows).
  //    When false ("Show all"), include "newsletter" and "unknown" (Needs review).
  // 2. recencyFilter:
  //    - "no-email-90": status is "No email 90+ days" and not marked "Still using"
  //    - "no-email-1y": status is "No email 1+ year" and not marked "Still using"
  //    - "all": all rows in the active type view
  const basePlatforms = (platforms ?? []).filter((p) => {
    if (accountsOnly && p.type !== "account") return false;
    return true;
  });

  const filteredPlatforms = basePlatforms.filter((p) => {
    if (recencyFilter === "no-email-90") {
      return p.status === "No email 90+ days" && !stillUsingIds.has(p.id);
    }
    if (recencyFilter === "no-email-1y") {
      return p.status === "No email 1+ year" && !stillUsingIds.has(p.id);
    }
    return true;
  });

  // Summary counts: Count ONLY "account" rows that are NOT marked "Still using"
  const unkeptAccounts = (platforms ?? []).filter(
    (p) => p.type === "account" && !stillUsingIds.has(p.id)
  );
  const summaryOver90Accounts = unkeptAccounts.filter(
    (p) => p.status === "No email 90+ days" || p.status === "No email 1+ year"
  ).length;

  // Count of non-account items hidden when accountsOnly is active
  const hiddenNonAccountsCount = (platforms ?? []).filter(
    (p) => p.type !== "account"
  ).length;

  // Filter tab counts (excluding rows marked "Still using" for 90+ days & 1+ year)
  const tabAllCount = basePlatforms.length;
  const tabOver90Count = basePlatforms.filter(
    (p) => p.status === "No email 90+ days" && !stillUsingIds.has(p.id)
  ).length;
  const tabOverYearCount = basePlatforms.filter(
    (p) => p.status === "No email 1+ year" && !stillUsingIds.has(p.id)
  ).length;

  const accountPlatforms = (platforms ?? []).filter((p) => p.type === "account");
  const riskScore = summary?.overallRiskScore ?? (accountPlatforms.length
    ? Math.round(accountPlatforms.reduce((sum, p) => sum + p.riskScore, 0) / accountPlatforms.length)
    : 0);
  const highRiskPlatforms = accountPlatforms
    .filter((p) => p.riskLevel === "high")
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);
  const highRiskCount = accountPlatforms.filter((p) => p.riskLevel === "high").length;
  const riskTone = riskScore >= 60 ? "#f87171" : riskScore >= 35 ? "#fbbf24" : "#34d399";
  const riskLabel = riskScore >= 60 ? "High attention" : riskScore >= 35 ? "Review recommended" : "Low attention";

  return (
    <section
      id="declutter"
      className="py-24 px-6 relative border-t border-white/5"
      aria-label="Mailbox Declutter feature"
    >
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] blur-[120px] rounded-full opacity-20 pointer-events-none"
          style={{ background: "var(--color-accent)" }}
        />
      </div>

      <div className="mx-auto max-w-5xl flex flex-col gap-10 relative">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border border-white/10"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              Privacy Feature
            </span>
            <span className="text-xs text-foreground/40 font-mono">
              Headers only · Zero storage
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <Sparkles
              className="size-7 shrink-0"
              style={{ color: "var(--color-accent)" }}
              aria-hidden
            />
            Mailbox Account Declutter
          </h2>

          <p className="text-sm md:text-base text-foreground/60 max-w-2xl leading-relaxed">
            Scan your own inbox headers to list platforms you have accounts with and flag
            accounts with no recent emails that you can safely delete or newsletters you can unsubscribe from.
          </p>
        </div>

        {/* Auth / Consent Control Card */}
        <div
          className="rounded-2xl border p-6 md:p-8 flex flex-col gap-6"
          style={{
            background: "var(--color-card)",
            borderColor: "color-mix(in oklch, white 8%, transparent)",
          }}
        >
          {authStatus === "loading" ? (
            <div className="flex items-center justify-center py-6 text-foreground/50 text-sm animate-pulse">
              Checking sign-in status…
            </div>
          ) : !session ? (
            /* Signed Out State */
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex flex-col gap-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: "var(--color-accent)" }} aria-hidden />
                  <span className="font-semibold text-foreground text-sm uppercase tracking-wider font-mono">
                    Consent & Privacy Guarantee
                  </span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                  Reads only email headers (sender, date, subject) from your own Gmail.
                  Nothing is stored. You can revoke access anytime in your Google account.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/50 mt-1">
                  <span className="flex items-center gap-1">
                    <Lock size={12} aria-hidden />
                    Zero database storage
                  </span>
                  <span>·</span>
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Manage permissions on Google
                    <ExternalLink size={10} aria-hidden />
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signIn("google")}
                className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95 flex items-center gap-2.5 shrink-0 shadow-lg cursor-pointer"
                style={{
                  background: "var(--color-accent)",
                  color: "#0a0a0a",
                }}
              >
                <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : (
            /* Signed In State */
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  {session.user?.image && !avatarError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "Google profile"}
                      onError={() => setAvatarError(true)}
                      className="size-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div
                      className="size-10 rounded-full flex items-center justify-center font-bold text-sm select-none"
                      style={{
                        background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
                        color: "var(--color-accent)",
                      }}
                    >
                      {session.user?.name
                        ? session.user.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "ME"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {session.user?.name ?? "Signed In"}
                    </p>
                    <p className="text-xs text-foreground/50 truncate font-mono">
                      {session.user?.email ?? ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/5 flex items-center gap-1.5 cursor-pointer text-foreground/70 hover:text-foreground border border-white/5"
                  >
                    <LogOut size={13} aria-hidden />
                    Sign out
                  </button>
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/5 inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground border border-white/5"
                  >
                    Revoke access
                    <ExternalLink size={11} aria-hidden />
                  </a>
                </div>
              </div>

              {/* Scan Trigger & Consent */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex flex-col gap-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Inbox size={16} style={{ color: "var(--color-accent)" }} aria-hidden />
                    <span className="text-xs uppercase font-mono tracking-wider font-semibold text-foreground/80">
                      Mailbox Inspection Consent
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                    Reads only email headers (sender, date, subject) from your own Gmail.
                    Nothing is stored. You can revoke access anytime in your Google account.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={scanning}
                  onClick={handleScan}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  style={{
                    background: "var(--color-accent)",
                    color: "#0a0a0a",
                  }}
                >
                  <RefreshCw
                    size={16}
                    className={scanning ? "animate-spin" : ""}
                    aria-hidden
                  />
                  {scanning ? "Scanning…" : "Scan my mailbox"}
                </button>
              </div>
            </div>
          )}

          {/* Test Mode / App Not Verified Notice */}
          <div
            className="rounded-xl p-3.5 text-xs flex items-start gap-2.5"
            style={{
              background: "color-mix(in oklch, white 3%, transparent)",
              border: "1px solid color-mix(in oklch, white 6%, transparent)",
              color: "var(--color-foreground)",
            }}
          >
            <Info size={15} className="shrink-0 mt-0.5 text-foreground/40" aria-hidden />
            <p className="text-foreground/50 leading-relaxed">
              <strong className="text-foreground/75 font-semibold">Development mode notice:</strong> If
              Google shows an &ldquo;App not verified&rdquo; screen during sign-in, this is expected for college
              educational projects in developer mode. Click{" "}
              <span className="text-foreground/80 font-mono">Advanced</span> &rarr;{" "}
              <span className="text-foreground/80 font-mono">Go to Smart Digital Declutter (unsafe)</span> to
              authorize your own mailbox.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl p-5 border flex items-start gap-3.5"
              style={{
                background: "color-mix(in oklch, #f87171 8%, transparent)",
                borderColor: "color-mix(in oklch, #f87171 25%, transparent)",
              }}
            >
              <AlertTriangle size={20} style={{ color: "#f87171" }} className="shrink-0 mt-0.5" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-sm text-foreground">Scan Error</p>
                <p className="text-sm text-foreground/70 leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Scan Progress */}
        <AnimatePresence>
          {scanning && progress && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border p-6 flex flex-col gap-4"
              style={{
                background: "var(--color-card)",
                borderColor: "color-mix(in oklch, var(--color-accent) 30%, transparent)",
              }}
              aria-live="polite"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-accent" style={{ color: "var(--color-accent)" }} />
                  {progress.message}
                </span>
                {progress.total > 0 && (
                  <span className="font-mono text-xs text-foreground/50">
                    {Math.round((progress.scanned / progress.total) * 100)}%
                  </span>
                )}
              </div>
              <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: "color-mix(in oklch, white 6%, transparent)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width:
                      progress.total > 0
                        ? `${Math.min(100, (progress.scanned / progress.total) * 100)}%`
                        : "20%",
                    background: "var(--color-accent)",
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scan Results */}
        {platforms && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-6"
          >
            {/* Summary Banner (Counts ONLY accounts that are NOT marked Keep) */}
            <div
              className="rounded-2xl border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 6%, var(--color-card))",
                borderColor: "color-mix(in oklch, var(--color-accent) 35%, transparent)",
              }}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs uppercase font-mono tracking-widest text-foreground/50 font-semibold">
                    Mailbox Audit Summary
                  </span>
                  {summary?.scannedEmails !== undefined && (
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-white/10"
                      style={{
                        background: "color-mix(in oklch, white 8%, transparent)",
                        color: "var(--color-accent)",
                      }}
                    >
                      Scanned {summary.scannedEmails} emails
                    </span>
                  )}
                  {stillUsingIds.size > 0 && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                      {stillUsingIds.size} still using
                    </span>
                  )}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground">
                  <span style={{ color: "#fbbf24" }}>{summaryOver90Accounts}</span> account{summaryOver90Accounts !== 1 ? "s" : ""} with no email for 90+ days — check whether you still use them.
                </h3>
                <p className="text-xs text-foreground/50 mt-1 max-w-2xl leading-relaxed">
                  *Last email received is a proxy for activity, not exact last login. Very old accounts (or those with all emails previously deleted) may still be missed. We never delete anything automatically.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all duration-200 hover:bg-white/10 active:scale-95 cursor-pointer text-foreground"
                  style={{
                    background: "color-mix(in oklch, white 8%, transparent)",
                    borderColor: "color-mix(in oklch, white 15%, transparent)",
                  }}
                >
                  <Download size={14} aria-hidden />
                  Download CSV
                </button>
              </div>
            </div>

            {/* Coverage note: Not seeing an account? */}
            {/* Risk Radar: prioritizes cleanup without claiming that an account is compromised. */}
            <div
              className="rounded-2xl border p-6 md:p-7"
              style={{
                background: "color-mix(in oklch, #f59e0b 5%, var(--color-card))",
                borderColor: "color-mix(in oklch, #f59e0b 28%, transparent)",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-mono font-semibold text-foreground/60">
                    <ShieldAlert size={15} style={{ color: riskTone }} aria-hidden />
                    Digital Footprint Risk Radar
                  </div>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">
                    {riskScore}/100 <span className="text-base font-medium" style={{ color: riskTone }}>{riskLabel}</span>
                  </h3>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/55">
                    This prioritizes cleanup from mailbox headers only. It is not proof of compromise, and no account is changed automatically.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center shrink-0">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xl font-bold text-foreground">{highRiskCount}</div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground/45">High priority</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xl font-bold text-foreground">{accountPlatforms.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground/45">Accounts scored</div>
                  </div>
                </div>
              </div>
              {highRiskPlatforms.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {highRiskPlatforms.map((p) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{p.displayName}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: riskTone }}>{p.riskScore}/100</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/60">{p.riskReasons[0]}</p>
                      <a href={p.deleteUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "var(--color-accent)" }}>
                        Review cleanup action <ArrowRight size={12} aria-hidden />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-foreground/55">No high-priority account was identified from this scan.</p>
              )}
            </div>

            {/* Coverage note: Not seeing an account? */}
            <div
              className="rounded-xl p-3.5 sm:p-4 text-xs flex items-start gap-3"
              style={{
                background: "color-mix(in oklch, white 3%, transparent)",
                border: "1px solid color-mix(in oklch, white 8%, transparent)",
              }}
            >
              <Info size={16} className="shrink-0 mt-0.5 text-foreground/50" aria-hidden />
              <p className="text-foreground/70 leading-relaxed">
                <strong className="text-foreground font-semibold">Not seeing an account?</strong>{" "}
                Accounts that never emailed you, or that use &lsquo;Sign in with Google&rsquo;, may not appear. Check your{" "}
                <a
                  href="https://myaccount.google.com/connections"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-foreground transition-colors inline-flex items-center gap-1"
                  style={{ color: "var(--color-accent)" }}
                >
                  Google connections page too
                  <ExternalLink size={11} aria-hidden />
                </a>
                .
              </p>
            </div>

            {/* Filters Bar: Accounts Only Toggle + Recency Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                {/* Accounts Only vs Show All Toggle */}
                <button
                  type="button"
                  onClick={() => setAccountsOnly((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer"
                  style={{
                    background: accountsOnly
                      ? "color-mix(in oklch, var(--color-accent) 15%, transparent)"
                      : "color-mix(in oklch, white 5%, transparent)",
                    borderColor: accountsOnly
                      ? "color-mix(in oklch, var(--color-accent) 40%, transparent)"
                      : "color-mix(in oklch, white 10%, transparent)",
                    color: accountsOnly ? "var(--color-accent)" : "var(--color-foreground)",
                  }}
                  aria-pressed={accountsOnly}
                >
                  <Filter size={12} aria-hidden />
                  <span className="font-semibold">
                    {accountsOnly ? "Accounts only (default)" : "Show all (incl. Newsletters & Needs review)"}
                  </span>
                  <span className="text-[10px] opacity-75 underline">
                    {accountsOnly ? "Show all" : "Accounts only"}
                  </span>
                </button>

                {/* Recency Tabs */}
                <div className="flex items-center gap-1.5" role="tablist" aria-label="Filter by recency">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={recencyFilter === "all"}
                    onClick={() => setRecencyFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                      recencyFilter === "all"
                        ? "text-[#0a0a0a] border-transparent font-semibold"
                        : "text-foreground/60 border-white/10 hover:text-foreground"
                    }`}
                    style={{
                      background:
                        recencyFilter === "all"
                          ? "var(--color-accent)"
                          : "color-mix(in oklch, white 5%, transparent)",
                    }}
                  >
                    All ({tabAllCount})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={recencyFilter === "no-email-90"}
                    onClick={() => setRecencyFilter("no-email-90")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                      recencyFilter === "no-email-90"
                        ? "bg-amber-400/90 text-[#0a0a0a] border-transparent font-semibold"
                        : "text-foreground/60 border-white/10 hover:text-foreground"
                    }`}
                    style={
                      recencyFilter !== "no-email-90"
                        ? { background: "color-mix(in oklch, white 5%, transparent)" }
                        : undefined
                    }
                  >
                    No email 90+ days ({tabOver90Count})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={recencyFilter === "no-email-1y"}
                    onClick={() => setRecencyFilter("no-email-1y")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                      recencyFilter === "no-email-1y"
                        ? "bg-white/20 text-foreground border-transparent font-semibold"
                        : "text-foreground/60 border-white/10 hover:text-foreground"
                    }`}
                    style={
                      recencyFilter !== "no-email-1y"
                        ? { background: "color-mix(in oklch, white 5%, transparent)" }
                        : undefined
                    }
                  >
                    No email 1+ year ({tabOverYearCount})
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono">
                <span className="text-foreground/40">
                  Showing {filteredPlatforms.length} of {platforms.length} items
                </span>
                {accountsOnly && hiddenNonAccountsCount > 0 && (
                  <span className="text-foreground/50">
                    · {hiddenNonAccountsCount} {hiddenNonAccountsCount === 1 ? "newsletter and unknown sender" : "newsletters and unknown senders"} hidden.{" "}
                    <button
                      type="button"
                      onClick={() => setAccountsOnly(false)}
                      className="underline font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: "var(--color-accent)" }}
                    >
                      Show all
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Desktop Table View (hidden on small screens, overflow-x-auto prevents clipping on narrow viewports) */}
            <div
              className="hidden md:block rounded-2xl border overflow-x-auto"
              style={{
                background: "var(--color-card)",
                borderColor: "color-mix(in oklch, white 8%, transparent)",
              }}
            >
              <table className="w-full text-left border-collapse min-w-full" aria-label="Platforms table">
                <thead>
                  <tr
                    className="border-b text-xs font-mono uppercase tracking-wider text-foreground/40"
                    style={{ borderColor: "color-mix(in oklch, white 6%, transparent)" }}
                  >
                    <th className="py-3 px-3.5 font-medium">Platform</th>
                    <th className="py-3 px-3.5 font-medium whitespace-nowrap">Type</th>
                    <th className="py-3 px-3.5 font-medium whitespace-nowrap">Last email</th>
                    <th className="py-3 px-3.5 font-medium whitespace-nowrap">Last activity email</th>
                    <th className="py-3 px-3.5 font-medium whitespace-nowrap">Status</th>
                    <th className="py-3 px-3.5 font-medium whitespace-nowrap">I still use this</th>
                    <th className="py-3 px-3.5 font-medium text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredPlatforms.map((p) => {
                    const isStillUsing = stillUsingIds.has(p.id);
                    const isLowConfidence =
                      p.emailCount < 3 ||
                      NOTIFICATION_ONLY_DOMAINS.has(p.domain.toLowerCase());
                    const statusStyle = getStatusStyles(p.status);

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isStillUsing ? "bg-white/[0.015]" : ""
                        }`}
                      >
                        {/* Platform name & domain (Row title is clean brand name or ESP sender name) */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="size-8 rounded-lg flex items-center justify-center font-bold text-xs select-none shrink-0"
                              style={{
                                background: "color-mix(in oklch, white 8%, transparent)",
                                color: "var(--color-accent)",
                              }}
                            >
                              {p.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate max-w-[130px] lg:max-w-[180px]">
                                  {p.displayName}
                                </span>
                                {isLowConfidence && <ConfidenceTooltip />}
                              </div>
                              <span className="text-xs font-mono text-foreground/40 truncate max-w-[130px] lg:max-w-[180px]">
                                {p.domain}
                              </span>
                              {p.senderDisplayName && (
                                <span className="text-[11px] text-foreground/45 truncate max-w-[130px] lg:max-w-[180px]">
                                  {p.senderDisplayName}
                                </span>
                              )}
                            </div>
                            {p.signupLike && (
                              <span
                                className="ml-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 text-foreground/40 shrink-0"
                                title="Welcome or signup email detected"
                              >
                                Signup
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Type badge + Accessible Why? tooltip */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {p.type === "account" ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono uppercase tracking-wider"
                                style={{
                                  background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                                  color: "var(--color-accent)",
                                  border: "1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)",
                                }}
                              >
                                Account
                              </span>
                            ) : p.type === "newsletter" ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono uppercase tracking-wider"
                                style={{
                                  background: "color-mix(in oklch, #818cf8 15%, transparent)",
                                  color: "#a5b4fc",
                                  border: "1px solid color-mix(in oklch, #818cf8 30%, transparent)",
                                }}
                              >
                                Newsletter
                              </span>
                            ) : (
                              /* Unknown rows get a "Needs review" badge */
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono uppercase tracking-wider"
                                style={{
                                  background: "color-mix(in oklch, #f59e0b 14%, transparent)",
                                  color: "#fbbf24",
                                  border: "1px solid color-mix(in oklch, #f59e0b 28%, transparent)",
                                }}
                              >
                                Needs review
                              </span>
                            )}

                           <WhyTooltip reason={p.reason} type={p.type} />
                           <TemporalBreachBadge platform={p} />
                          </div>
                        </td>

                        {/* Last email */}
                        <td className="py-3 px-3.5 text-foreground/80 font-mono text-xs whitespace-nowrap">
                          {p.lastAnyEmailFormatted ?? p.lastSeenFormatted}
                        </td>

                        {/* Last activity-type email */}
                        <td className="py-3 px-3.5 font-mono text-xs whitespace-nowrap">
                          {p.lastActivityEmailFormatted ? (
                            <span className="text-foreground/80">{p.lastActivityEmailFormatted}</span>
                          ) : (
                            <span className="text-foreground/35">None detected</span>
                          )}
                        </td>

                        {/* Status badge + Basis */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: statusStyle.bg,
                                color: statusStyle.color,
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: statusStyle.dot }}
                                aria-hidden
                              />
                              {p.status}
                            </span>
                            {p.statusBasis === "any" && (
                              <span
                                className="text-[10px] text-foreground/40 font-mono pl-1"
                                title="No activity email found; status is based on latest general email"
                              >
                                Based on any email
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Still using toggle button (shrunk: icon plus short label, no text wrapping) */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleStillUsing(p.id)}
                            aria-pressed={isStillUsing}
                            aria-label={isStillUsing ? `Marked still using ${p.displayName}` : `I still use ${p.displayName}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                              isStillUsing
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-semibold shadow-sm"
                                : "border-white/10 text-foreground/60 hover:text-foreground hover:bg-white/5"
                            }`}
                          >
                            {isStillUsing ? (
                              <>
                                <BookmarkCheck size={12} aria-hidden />
                                <span>Still using</span>
                              </>
                            ) : (
                              <>
                                <Bookmark size={12} aria-hidden />
                                <span>I still use this</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Action column (shrunk: icon plus short label, no text wrapping) */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                       {p.type === "newsletter" ? (
                            /* Newsletters get a compact Unsubscribe link */
                            <a
                              href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(p.domain)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors hover:bg-white/10 whitespace-nowrap"
                              style={{
                                borderColor: "color-mix(in oklch, #818cf8 35%, transparent)",
                                color: "#a5b4fc",
                              }}
                              title="Use the unsubscribe link in the latest email from this sender."
                            >
                              <Mail size={12} aria-hidden />
                              <span>Unsubscribe</span>
                              <ExternalLink size={10} aria-hidden />
                            </a>
                          ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              {p.status !== "Recent email" && (
                                <a href={p.deleteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border hover:bg-white/10 whitespace-nowrap" style={{ borderColor: "color-mix(in oklch, white 12%, transparent)", color: "var(--color-foreground)" }} title={`How to delete account on ${p.displayName}`}>
                                  <Trash2 size={12} className="text-foreground/50" aria-hidden />
                                  <span>How to delete</span>
                                  <ExternalLink size={10} aria-hidden />
                                </a>
                              )}
                              <button type="button" onClick={() => { setLegalPlatform(p); setLegalRegulation("COMBINED"); }} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 whitespace-nowrap cursor-pointer" title="Generate a formal data erasure notice">
                                <ShieldAlert size={12} aria-hidden />
                                Legal Erasure Notice
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (hidden on md+) */}
            <div className="md:hidden flex flex-col gap-3">
              {filteredPlatforms.map((p) => {
                const isStillUsing = stillUsingIds.has(p.id);
                const isLowConfidence =
                  p.emailCount < 3 ||
                  NOTIFICATION_ONLY_DOMAINS.has(p.domain.toLowerCase());
                const statusStyle = getStatusStyles(p.status);

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-5 flex flex-col gap-3.5 ${
                      isStillUsing ? "bg-white/[0.02] border-emerald-500/20" : ""
                    }`}
                    style={{
                      background: "var(--color-card)",
                      borderColor: isStillUsing
                        ? "color-mix(in oklch, #10b981 30%, transparent)"
                        : "color-mix(in oklch, white 8%, transparent)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="size-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                          style={{
                            background: "color-mix(in oklch, white 8%, transparent)",
                            color: "var(--color-accent)",
                          }}
                        >
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate">
                              {p.displayName}
                            </span>
                            {isLowConfidence && <ConfidenceTooltip />}
                          </div>
                          <span className="text-xs font-mono text-foreground/40 truncate">
                            {p.domain}
                          </span>
                          {p.senderDisplayName && (
                            <span className="text-[11px] text-foreground/45 truncate">
                              {p.senderDisplayName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: statusStyle.dot }}
                            aria-hidden
                          />
                          {p.status}
                        </span>

                        {p.statusBasis === "any" && (
                          <span className="text-[10px] text-foreground/40 font-mono">
                            Based on any email
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {p.type === "account" ? (
                            <span
                              className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                              style={{
                                background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                                color: "var(--color-accent)",
                              }}
                            >
                              Account
                            </span>
                          ) : p.type === "newsletter" ? (
                            <span
                              className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                              style={{
                                background: "color-mix(in oklch, #818cf8 15%, transparent)",
                                color: "#a5b4fc",
                              }}
                            >
                              Newsletter
                            </span>
                          ) : (
                            <span
                              className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                              style={{
                                background: "color-mix(in oklch, #f59e0b 14%, transparent)",
                                color: "#fbbf24",
                              }}
                            >
                              Needs review
                            </span>
                          )}
                           <WhyTooltip reason={p.reason} type={p.type} />
                           <TemporalBreachBadge platform={p} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs text-foreground/60 border-t border-white/5 pt-3 font-mono">
                      <div className="flex items-center justify-between">
                        <span>Last email:</span>
                        <strong className="text-foreground/85 font-medium">
                          {p.lastAnyEmailFormatted ?? p.lastSeenFormatted}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Last activity email:</span>
                        <strong className="text-foreground/85 font-medium">
                          {p.lastActivityEmailFormatted ?? "None detected"}
                        </strong>
                      </div>
                    </div>

                    {/* Actions in mobile card */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleStillUsing(p.id)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                          isStillUsing
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-semibold"
                            : "border-white/10 text-foreground/70 hover:bg-white/5"
                        }`}
                      >
                        {isStillUsing ? (
                          <>
                            <BookmarkCheck size={13} aria-hidden />
                            <span>Still using</span>
                          </>
                        ) : (
                          <>
                            <Bookmark size={13} aria-hidden />
                            <span>I still use this</span>
                          </>
                        )}
                      </button>

                      {p.type === "newsletter" ? (
                        <div className="flex-1 flex flex-col gap-0.5">
                          <a
                            href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(p.domain)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors hover:bg-white/10"
                            style={{
                              borderColor: "color-mix(in oklch, #818cf8 35%, transparent)",
                              color: "#a5b4fc",
                            }}
                          >
                            <Mail size={12} aria-hidden />
                            Unsubscribe
                            <ExternalLink size={10} aria-hidden />
                          </a>
                        </div>
                       ) : (
                         <div className="flex flex-1 flex-col gap-2">
                           {p.status !== "Recent email" && (
                             <a href={p.deleteUrl} target="_blank" rel="noopener noreferrer" className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors hover:bg-white/10" style={{ borderColor: "color-mix(in oklch, white 12%, transparent)", color: "var(--color-foreground)" }}>
                               <Trash2 size={12} className="text-foreground/50" aria-hidden />
                               How to delete
                               <ExternalLink size={10} aria-hidden />
                             </a>
                           )}
                           <button type="button" onClick={() => { setLegalPlatform(p); setLegalRegulation("COMBINED"); }} className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer">
                             Legal Erasure Notice
                           </button>
                         </div>
                       )}
                    </div>

                    {p.type === "newsletter" && (
                      <p className="text-[10px] text-foreground/45 text-center leading-tight">
                        Use the unsubscribe link in the latest email from this sender.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Note under the table on event-based email behavior */}
            <p className="text-xs text-foreground/50 leading-relaxed px-1 mt-1">
              Platforms like GitHub, Pinterest and Discord email you only on events, so a quiet inbox does not mean an unused account.
            </p>
          </motion.div>
        )}
       </div>
       {legalPlatform && (
         <LegalErasureModal
           platform={legalPlatform}
           userEmail={session?.user?.email ?? ""}
           regulation={legalRegulation}
           onRegulationChange={setLegalRegulation}
           onClose={() => setLegalPlatform(null)}
         />
       )}
     </section>
  );
}
