"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  Calendar,
  Filter,
  CheckCircle2,
} from "lucide-react";
import {
  type FinancialSummary,
  type SubscriptionRecord,
  type TrialRecord,
  type PriceChangeEvent,
  type CurrencyCode,
} from "@/lib/intelligence/financial/financialTypes";
import { type PrioritizedAction } from "@/lib/intelligence/recommendations/recommendationEngine";
import { consumeNdjsonStream } from "@/lib/ndjsonStream";

interface ScanProgress {
  stage: number;
  percent: number;
  message: string;
}

export function FinancialDashboard() {
  const { data: session, status } = useSession();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>("USD");

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceChangeEvent[]>([]);
  const [actionPlan, setActionPlan] = useState<PrioritizedAction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const startScan = async () => {
    setIsScanning(true);
    setError(null);
    setProgress({ stage: 1, percent: 10, message: "Initiating mailbox financial scan…" });

    try {
      const response = await fetch("/api/financial/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Google session expired or authorization was revoked. Please sign in again.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Scan request failed with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from financial scan endpoint");
      }

      await consumeNdjsonStream(
        response.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data: any) => {
          if (data.type === "progress") {
            setProgress({
              stage: data.stage || 1,
              percent: data.percent || 20,
              message: data.message || "Analyzing financial records…",
            });
          } else if (data.type === "done") {
            setSummary(data.summary);
            setSubscriptions(data.subscriptions || []);
            setTrials(data.trials || []);
            setPriceAlerts(data.priceAlerts || []);
            setActionPlan(data.actionPlan || []);
            setIsScanning(false);
            setProgress(null);
          } else if (data.type === "error") {
            throw new Error(data.error || "An error occurred during financial analysis");
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete financial scan");
      setIsScanning(false);
      setProgress(null);
    }
  };

  const filteredSubscriptions =
    categoryFilter === "ALL"
      ? subscriptions
      : subscriptions.filter((s) => s.category === categoryFilter);

  const currencySymbol = preferredCurrency === "INR" ? "₹" : "$";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <CreditCard size={13} aria-hidden />
            <span>Financial Intelligence & Subscription Radar</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Subscription & Spend Radar
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Audit recurring SaaS plans, streaming services, free trial countdowns, and stealth price increases from your mailbox.
          </p>
        </div>

        {/* Action / Currency Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setPreferredCurrency("USD")}
              className={`rounded px-2.5 py-1 font-medium transition-all ${
                preferredCurrency === "USD"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setPreferredCurrency("INR")}
              className={`rounded px-2.5 py-1 font-medium transition-all ${
                preferredCurrency === "INR"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              INR (₹)
            </button>
          </div>

          {session ? (
            <button
              type="button"
              onClick={startScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Sparkles size={14} className={isScanning ? "animate-spin" : ""} aria-hidden />
              <span>{isScanning ? "Scanning Mailbox…" : "Scan Financials"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500"
            >
              <span>Sign in to Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Authentication Prompt (If not signed in) ─────────── */}
      {!session && status !== "loading" && (
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CreditCard size={24} aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Sign in with Google to Audit Your Subscriptions
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-foreground/60">
            Our privacy-first financial engine audits message headers and receipt snippets in volatile memory to identify active recurring payments, trial expiration dates, and price increases. Raw email bodies are never stored.
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500"
          >
            <span>Connect Gmail Account</span>
          </button>
        </div>
      )}

      {/* ── Progress Bar ───────────────────────────────────────── */}
      {isScanning && progress && (
        <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-300">
            <span className="flex items-center gap-2">
              <span className="size-2 animate-ping rounded-full bg-emerald-400" />
              {progress.message}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-950/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
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
            <span className="font-semibold">Financial Scan Error: </span>
            {error}
          </div>
        </div>
      )}

      {/* ── Main Dashboard Content ─────────────────────────────── */}
      {summary && (
        <div className="space-y-8">
          {/* SECTION A: Overview Hero Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-foreground/50">
                <span className="text-xs font-medium">Est. Monthly Spend</span>
                <DollarSign size={16} className="text-emerald-400" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {currencySymbol}
                {summary.estimatedMonthlyRecurringCost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">
                Normalized estimated recurring commitment
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-foreground/50">
                <span className="text-xs font-medium">Est. Annual Spend</span>
                <TrendingUp size={16} className="text-cyan-400" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {currencySymbol}
                {summary.estimatedAnnualRecurringCost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">
                Projected 12-month recurring expenditure
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-foreground/50">
                <span className="text-xs font-medium">Active Subscriptions</span>
                <Layers size={16} className="text-indigo-400" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                {summary.totalActiveSubscriptions}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">
                Across SaaS, streaming & memberships
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-foreground/50">
                <span className="text-xs font-medium">Active Free Trials</span>
                <Clock size={16} className="text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {summary.activeTrialsCount}
                </span>
                {summary.priceHikeAlertsCount > 0 && (
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                    {summary.priceHikeAlertsCount} price hikes
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-foreground/50">
                Requires monitoring to avoid auto-charges
              </p>
            </div>
          </div>

          {/* SECTION D: Price-Hike Alerts (If Any) */}
          {priceAlerts.length > 0 && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert size={16} />
                <h2 className="text-sm font-semibold tracking-tight">
                  Price-Hike & Rate Change Alerts ({priceAlerts.length})
                </h2>
              </div>
              <p className="mt-1 text-xs text-foreground/60">
                We detected rate adjustments on historical subscriptions. Review each adjustment to confirm whether your plan changed or the vendor increased prices.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {priceAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col justify-between rounded-lg border border-rose-500/20 bg-black/40 p-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">
                          {alert.merchantName}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            alert.percentageChange > 0
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {alert.percentageChange > 0 ? "+" : ""}
                          {alert.percentageChange}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-foreground/70">
                        Shifted from{" "}
                        <span className="font-medium text-foreground">
                          {alert.currency} {alert.previousAmount.toFixed(2)}
                        </span>{" "}
                        to{" "}
                        <span className="font-bold text-foreground">
                          {alert.currency} {alert.newAmount.toFixed(2)}
                        </span>{" "}
                        on {alert.effectiveDate.slice(0, 10)}.
                      </div>
                      {alert.isAmbiguous && alert.ambiguityReason && (
                        <p className="mt-1 text-[11px] text-amber-400/90 italic">
                          Notice: {alert.ambiguityReason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION C: Free Trial Monitor */}
          {trials.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-400">
                <Clock size={16} />
                <h2 className="text-sm font-semibold tracking-tight">
                  Free Trial Radar & Countdown ({trials.length})
                </h2>
              </div>
              <p className="mt-1 text-xs text-foreground/60">
                Active trials detected in your inbox. Cancel before the expiration date if you do not plan to continue the subscription.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trials.map((trial) => {
                  const isUrgent = trial.daysRemaining <= 3 && trial.status !== "CANCELLED";
                  return (
                    <div
                      key={trial.id}
                      className={`flex flex-col justify-between rounded-lg border p-4 ${
                        isUrgent
                          ? "border-rose-500/30 bg-rose-950/20"
                          : "border-white/10 bg-black/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">
                            {trial.serviceName}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              trial.status === "CANCELLED"
                                ? "bg-zinc-800 text-zinc-400"
                                : isUrgent
                                ? "bg-rose-500/20 text-rose-300 animate-pulse"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {trial.status === "CANCELLED"
                              ? "Cancelled"
                              : trial.daysRemaining >= 0
                              ? `${trial.daysRemaining} days left`
                              : "Expired"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-foreground/70">
                          Expires:{" "}
                          <span className="font-medium text-foreground">
                            {trial.trialExpirationDate.slice(0, 10)}
                          </span>
                        </p>
                        {trial.expectedPostTrialAmount && (
                          <p className="mt-1 text-xs text-foreground/70">
                            Post-Trial Rate:{" "}
                            <span className="font-semibold text-foreground">
                              {trial.currency || "USD"} {trial.expectedPostTrialAmount}
                            </span>
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-foreground/50 leading-relaxed">
                          {trial.cancellationGuide}
                        </p>
                      </div>

                      {trial.cancellationUrl && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <a
                            href={trial.cancellationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                          >
                            <span>Manage / Cancel Plan</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION B: Subscription Table */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Detected Subscriptions ({filteredSubscriptions.length})
                </h2>
                <p className="mt-0.5 text-xs text-foreground/60">
                  Recurring services derived from invoices, receipts, and billing notices.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter size={13} className="text-foreground/50" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="SAAS">SaaS & Developer</option>
                  <option value="STREAMING">Streaming</option>
                  <option value="CLOUD_STORAGE">Cloud Storage</option>
                  <option value="SOFTWARE_LICENSE">Software Licenses</option>
                  <option value="MEMBERSHIP">Memberships</option>
                  <option value="SERVICES">Services</option>
                </select>
              </div>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground/50">
                No active subscriptions detected matching the selected filter.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-foreground/50">
                      <th className="pb-3 font-medium">Merchant</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Cadence</th>
                      <th className="pb-3 font-medium">Last Billed</th>
                      <th className="pb-3 font-medium">Est. Monthly</th>
                      <th className="pb-3 font-medium">Next Renewal</th>
                      <th className="pb-3 font-medium">Confidence</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredSubscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 font-semibold text-foreground">
                          {sub.merchantName}
                          <span className="block text-[10px] font-normal text-foreground/40">
                            {sub.canonicalDomain}
                          </span>
                        </td>
                        <td className="py-3.5 text-foreground/70">
                          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium">
                            {sub.category}
                          </span>
                        </td>
                        <td className="py-3.5 text-foreground/70">
                          {sub.billingFrequency}
                        </td>
                        <td className="py-3.5 text-foreground/70">
                          {sub.currency} {sub.lastAmount.toFixed(2)}
                          <span className="block text-[10px] text-foreground/40">
                            {sub.lastDetectedDate.slice(0, 10)}
                          </span>
                        </td>
                        <td className="py-3.5 font-medium text-foreground">
                          {sub.currency} {sub.estimatedMonthlyCost.toFixed(2)}
                        </td>
                        <td className="py-3.5 text-foreground/70">
                          {sub.nextRenewalDate ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={11} className="text-foreground/40" />
                              {sub.nextRenewalDate.slice(0, 10)}
                            </span>
                          ) : (
                            <span className="text-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              sub.verificationStatus === "CONFIRMED_FACT"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {sub.verificationStatus === "CONFIRMED_FACT" ? "Confirmed" : "Inferred"}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          {sub.cancellationUrl ? (
                            <a
                              href={sub.cancellationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground"
                            >
                              <span>Manage</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-foreground/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION E: Spending Analytics */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Merchant Spend Ranking */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Top Merchant Spend
              </h3>
              <div className="mt-4 space-y-3">
                {summary.spendingByMerchant.slice(0, 5).map((m) => {
                  const percent =
                    summary.estimatedMonthlyRecurringCost > 0
                      ? Math.round(
                          (m.monthlyCost / summary.estimatedMonthlyRecurringCost) * 100
                        )
                      : 0;
                  return (
                    <div key={m.canonicalDomain} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{m.merchantName}</span>
                        <span className="text-foreground/70">
                          {m.currency} {m.monthlyCost.toFixed(2)}/mo
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations & Action Plan */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Recommended Actions ({actionPlan.length})
              </h3>
              <div className="mt-4 space-y-2.5">
                {actionPlan.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-foreground/50">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>No urgent financial action items detected.</span>
                  </div>
                ) : (
                  actionPlan.slice(0, 4).map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start justify-between rounded-lg border border-white/5 bg-black/40 p-3"
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
                          <span className="font-semibold text-xs text-foreground">
                            {action.label}
                          </span>
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
                          className="ml-3 shrink-0 rounded bg-white/5 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-white/10"
                        >
                          Action
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
