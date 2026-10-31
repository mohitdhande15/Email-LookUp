"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Mail,
  ExternalLink,
  Users,
  BookOpen,
  Shield,
  ShieldOff,
  ShieldAlert,
  MapPin,
  Building2,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import type { SourceResult } from "@/lib/sources/types";
import type { SearchState } from "@/components/shared/Hero";
import type { BreachEntry } from "@/lib/sources/breach";

/* ── helpers ───────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse ${className ?? ""}`}
      style={{ background: "color-mix(in oklch, white 8%, transparent)" }}
      aria-hidden
    />
  );
}

function CardShell({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4"
      style={{
        background: "var(--color-card)",
        borderColor: accent
          ? "color-mix(in oklch, var(--color-accent) 30%, transparent)"
          : "color-mix(in oklch, white 8%, transparent)",
      }}
    >
      {children}
    </div>
  );
}

function SourceBadge({
  label,
  status,
}: {
  label: string;
  status: "found" | "not_found" | "error" | "loading";
}) {
  const colors: Record<typeof status, string> = {
    found: "var(--color-accent)",
    not_found: "#6b7280",
    error: "#f87171",
    loading: "#a0aec0",
  };
  const labels: Record<typeof status, string> = {
    found: "Found",
    not_found: "Not found",
    error: "Error",
    loading: "Checking…",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
        {label}
      </span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{
          color: colors[status],
          background: `color-mix(in oklch, ${colors[status]} 12%, transparent)`,
        }}
      >
        {labels[status]}
      </span>
    </div>
  );
}

/* ── Profile Summary Card ───────────────────────────────────────── */

function ProfileSummaryCard({ results }: { results: SourceResult[] }) {
  const gravatar = results.find((r) => r.source === "gravatar");
  const github = results.find((r) => r.source === "github");

  const gd = gravatar?.status === "found" ? gravatar.data : null;
  const ghd = github?.status === "found" ? github.data : null;

  if (!gd && !ghd) return null;

  const gravatarName = gd?.name as string | null;
  const githubName = ghd?.name as string | null;

  const name: string | null = gravatarName ?? githubName;
  let confidence = 0;

  if (gravatarName && githubName) {
    confidence =
      gravatarName.toLowerCase().trim() === githubName.toLowerCase().trim()
        ? 100
        : 55;
  } else if (gravatarName || githubName) {
    confidence = 60;
  }

  const avatarUrl =
    (gd?.avatarUrl as string | null) ?? (ghd?.avatarUrl as string | null);
  const location =
    (gd?.location as string | null) ?? (ghd?.location as string | null);
  const job = gd?.jobTitle as string | null;
  const company =
    (gd?.company as string | null) ?? (ghd?.company as string | null);

  const confidenceLabel =
    confidence >= 90 ? "High" : confidence >= 60 ? "Medium" : "Low";
  const confidenceColor =
    confidence >= 90 ? "var(--color-accent)" : confidence >= 60 ? "#fbbf24" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <CardShell accent>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Profile Summary
          </h3>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: confidenceColor,
              background: `color-mix(in oklch, ${confidenceColor} 12%, transparent)`,
            }}
          >
            {confidenceLabel} confidence
          </span>
        </div>

        <div className="flex items-start gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name ?? "Profile avatar"}
              className="size-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="size-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 select-none"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              {name ? name.slice(0, 2).toUpperCase() : "?"}
            </div>
          )}

          <div className="flex flex-col gap-1 min-w-0">
            {name && (
              <p className="font-bold text-xl text-foreground leading-tight truncate">
                {name}
              </p>
            )}
            {job && (
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                <Briefcase size={13} aria-hidden />
                <span className="truncate">{job}</span>
              </div>
            )}
            {company && (
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                <Building2 size={13} aria-hidden />
                <span className="truncate">{company}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                <MapPin size={13} aria-hidden />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        </div>
      </CardShell>
    </motion.div>
  );
}

/* ── Gravatar Card ──────────────────────────────────────────────── */

function GravatarCard({ result }: { result?: SourceResult }) {
  if (!result) {
    return (
      <CardShell>
        <SourceBadge label="Gravatar" status="loading" />
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <CardShell>
        <SourceBadge label="Gravatar" status="not_found" />
        <p className="text-sm text-foreground/50">No public Gravatar profile found for this email.</p>
      </CardShell>
    );
  }

  if (result.status === "error") {
    return (
      <CardShell>
        <SourceBadge label="Gravatar" status="error" />
        <p className="text-sm text-foreground/50">{result.message ?? "An error occurred."}</p>
      </CardShell>
    );
  }

  const d = result.data!;
  const gName = d.name as string | null;
  const gJobTitle = d.jobTitle as string | null;
  const gCompany = d.company as string | null;
  const gLocation = d.location as string | null;
  const gAvatarUrl = d.avatarUrl as string | null;
  const gProfileUrl = d.profileUrl as string | null;
  const verified = (d.verifiedAccounts as Array<{ label: string; url: string }>) ?? [];

  return (
    <CardShell>
      <SourceBadge label="Gravatar" status="found" />

      <div className="flex items-start gap-4">
        {gAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gAvatarUrl}
            alt={gName ?? "Gravatar avatar"}
            className="size-14 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="size-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 select-none"
            style={{
              background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            {gName ? gName.slice(0, 2).toUpperCase() : "?"}
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          {gName && <p className="font-semibold text-foreground truncate">{gName}</p>}
          {gJobTitle && (
            <div className="flex items-center gap-1.5 text-sm text-foreground/60">
              <Briefcase size={13} aria-hidden />
              <span>{gJobTitle}</span>
            </div>
          )}
          {gCompany && (
            <div className="flex items-center gap-1.5 text-sm text-foreground/60">
              <Building2 size={13} aria-hidden />
              <span>{gCompany}</span>
            </div>
          )}
          {gLocation && (
            <div className="flex items-center gap-1.5 text-sm text-foreground/60">
              <MapPin size={13} aria-hidden />
              <span>{gLocation}</span>
            </div>
          )}
          {gProfileUrl && (
            <a
              href={gProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-1 hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-accent)" }}
            >
              View profile <ExternalLink size={11} aria-hidden />
            </a>
          )}
        </div>
      </div>

      {verified.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/40 font-mono uppercase tracking-widest">
            Verified accounts
          </p>
          <div className="flex flex-col gap-1.5">
            {verified.map((acct) => (
              <div
                key={acct.url || acct.label}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2
                  size={13}
                  style={{ color: "var(--color-accent)" }}
                  aria-hidden
                />
                {acct.url ? (
                  <a
                    href={acct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {acct.label}
                  </a>
                ) : (
                  <span className="text-foreground/70">{acct.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

/* ── GitHub Card ────────────────────────────────────────────────── */

function GitHubCard({ result }: { result?: SourceResult }) {
  if (!result) {
    return (
      <CardShell>
        <SourceBadge label="GitHub" status="loading" />
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </CardShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <CardShell>
        <SourceBadge label="GitHub" status="not_found" />
        <p className="text-sm text-foreground/50">
          No GitHub account found with this email (only public email addresses are searchable).
        </p>
      </CardShell>
    );
  }

  if (result.status === "error") {
    return (
      <CardShell>
        <SourceBadge label="GitHub" status="error" />
        <p className="text-sm text-foreground/50">{result.message ?? "An error occurred."}</p>
      </CardShell>
    );
  }

  const d = result.data!;
  const ghName = d.name as string | null;
  const ghLogin = d.login as string | null;
  const ghBio = d.bio as string | null;
  const ghCompany = d.company as string | null;
  const ghLocation = d.location as string | null;
  const ghAvatarUrl = d.avatarUrl as string | null;
  const ghProfileUrl = d.profileUrl as string | null;
  const ghFollowers = d.followers as number;
  const ghPublicRepos = d.publicRepos as number;
  const ghLastPublicActivity = d.lastPublicActivity as string | null;

  return (
    <CardShell>
      <SourceBadge label="GitHub" status="found" />

      <div className="flex items-start gap-4">
        {ghAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ghAvatarUrl}
            alt={ghName ?? ghLogin ?? "GitHub avatar"}
            className="size-14 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="size-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 select-none"
            style={{
              background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            GH
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          {ghName && (
            <p className="font-semibold text-foreground truncate">{ghName}</p>
          )}
          {ghLogin && (
            <a
              href={ghProfileUrl ?? `https://github.com/${ghLogin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:opacity-80 transition-opacity inline-flex items-center gap-1"
              style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
            >
              @{ghLogin} <ExternalLink size={11} aria-hidden />
            </a>
          )}
          {ghBio && (
            <p className="text-sm text-foreground/60 leading-relaxed mt-1 line-clamp-3">
              {ghBio}
            </p>
          )}
          {ghCompany && (
            <div className="flex items-center gap-1.5 text-sm text-foreground/60">
              <Building2 size={13} aria-hidden />
              <span>{ghCompany}</span>
            </div>
          )}
          {ghLocation && (
            <div className="flex items-center gap-1.5 text-sm text-foreground/60">
              <MapPin size={13} aria-hidden />
              <span>{ghLocation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 border-t"
        style={{ borderColor: "color-mix(in oklch, white 8%, transparent)" }}
      >
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <Users size={14} aria-hidden />
          <span>
            <strong className="text-foreground">{ghFollowers.toLocaleString()}</strong>{" "}
            followers
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <BookOpen size={14} aria-hidden />
          <span>
            <strong className="text-foreground">{ghPublicRepos.toLocaleString()}</strong>{" "}
            repositories
          </span>
        </div>
        {ghLastPublicActivity && (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Clock size={14} aria-hidden />
            <span>
              Last active:{" "}
              <strong className="text-foreground">
                {new Date(ghLastPublicActivity).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
            </span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

/* ── Breach Card ────────────────────────────────────────────────── */

function BreachCard({ result }: { result?: SourceResult }) {
  if (!result) {
    return (
      <CardShell>
        <SourceBadge label="Breach Check" status="loading" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
      </CardShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <CardShell>
        <SourceBadge label="Breach Check" status="not_found" />
        <div className="flex items-start gap-3">
          <Shield size={20} style={{ color: "var(--color-accent)" }} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">No known breaches</p>
            <p className="text-xs text-foreground/50 mt-0.5">
              This email was not found in the XposedOrNot database.
            </p>
          </div>
        </div>
        <DisclaimerNote />
      </CardShell>
    );
  }

  if (result.status === "error") {
    return (
      <CardShell>
        <SourceBadge label="Breach Check" status="error" />
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} style={{ color: "#f87171" }} aria-hidden />
          <p className="text-sm text-foreground/50">{result.message ?? "Breach check failed."}</p>
        </div>
        <DisclaimerNote />
      </CardShell>
    );
  }

  const d = result.data!;
  const count = d.count as number;
  const breaches = d.breaches as BreachEntry[];
  const hasDetails = d.hasDetails as boolean;

  return (
    <CardShell>
      <SourceBadge label="Breach Check" status="found" />

      <div className="flex items-start gap-3">
        <ShieldOff size={20} style={{ color: "#f87171" }} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Found in <span style={{ color: "#f87171" }}>{count} breach{count !== 1 ? "es" : ""}</span>
          </p>
          <p className="text-xs text-foreground/50 mt-0.5">
            {hasDetails
              ? "Detailed breach information available below."
              : "Showing breach names only."}
          </p>
        </div>
      </div>

      {/* Breach list */}
      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {breaches.map((breach, i) => (
          <div
            key={`${breach.name}-${i}`}
            className="rounded-xl p-3 flex flex-col gap-1"
            style={{
              background: "color-mix(in oklch, white 4%, transparent)",
              border: "1px solid color-mix(in oklch, white 7%, transparent)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {breach.name}
              </span>
              {breach.date && (
                <span
                  className="text-xs font-mono shrink-0"
                  style={{ color: "#f87171" }}
                >
                  {breach.date}
                </span>
              )}
            </div>
            {breach.industry && (
              <span className="text-xs text-foreground/40">{breach.industry}</span>
            )}
            {breach.records != null && (
              <span className="text-xs text-foreground/40">
                {breach.records.toLocaleString()} records exposed
              </span>
            )}
            {breach.xposedData && breach.xposedData.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {breach.xposedData.map((cat, ci) => (
                  <span
                    key={`${cat}-${ci}`}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: "color-mix(in oklch, #f87171 10%, transparent)",
                      color: "#f87171",
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <DisclaimerNote />
    </CardShell>
  );
}

function DisclaimerNote() {
  return (
    <div
      className="flex items-start gap-2 rounded-xl p-3 text-xs text-foreground/50"
      style={{ background: "color-mix(in oklch, white 4%, transparent)" }}
    >
      <Info size={13} className="shrink-0 mt-0.5" aria-hidden />
      <span>
        Based on the XposedOrNot database. Not found does not guarantee the email was never exposed.
      </span>
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────────────── */

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/50 font-mono">{label}</span>
        <span className="text-foreground/50 font-mono">{progress}%</span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "color-mix(in oklch, white 8%, transparent)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--color-accent)" }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ── Results section ────────────────────────────────────────────── */

interface ResultsProps {
  searchState: SearchState | null;
}

export function Results({ searchState }: ResultsProps) {
  const reduced = useReducedMotion() ?? false;

  const results = searchState?.results ?? [];
  const gravatar = results.find((r) => r.source === "gravatar");
  const github = results.find((r) => r.source === "github");
  const breach = results.find((r) => r.source === "breach");

  const hasAnyFound = results.some((r) => r.status === "found");

  return (
    <section id="results" aria-label="Search results" className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-foreground/40">
            Results
          </h2>
          {searchState?.query && (
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-full"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 10%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              {searchState.query}
            </span>
          )}
        </div>

        {/* Empty state */}
        {!searchState && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border flex flex-col items-center justify-center gap-4 py-20 px-8 text-center"
            style={{
              background: "var(--color-card)",
              borderColor: "color-mix(in oklch, white 7%, transparent)",
              borderStyle: "dashed",
            }}
          >
            <div
              className="size-14 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 10%, transparent)",
              }}
            >
              <Mail size={24} style={{ color: "var(--color-accent)" }} aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">
                Enter an email to see results
              </p>
              <p className="text-sm text-foreground/50 mt-1 max-w-xs">
                Type an email address in the search bar above and press{" "}
                <kbd
                  className="rounded px-1.5 py-0.5 text-xs border"
                  style={{
                    borderColor: "color-mix(in oklch, white 15%, transparent)",
                    background: "color-mix(in oklch, white 5%, transparent)",
                  }}
                >
                  Search
                </kbd>{" "}
                to look up publicly available profile data.
              </p>
            </div>
          </motion.div>
        )}

        {/* Active results */}
        {searchState && (
          <motion.div
            key={searchState.query}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-6"
          >
            {/* Progress bar while searching */}
            <AnimatePresence>
              {searchState.searching && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ProgressBar
                    progress={searchState.progress ?? 50}
                    label={searchState.progressLabel ?? "Searching…"}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile summary – shown once at least one source found */}
            <AnimatePresence>
              {hasAnyFound && (
                <ProfileSummaryCard results={results} />
              )}
            </AnimatePresence>

            {/* Source cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <GravatarCard result={gravatar} />
              <GitHubCard result={github} />
              <BreachCard result={breach} />
            </div>

            {/* Security tip */}
            {!searchState.searching && breach?.status === "found" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-3 rounded-2xl p-4"
                style={{
                  background: "color-mix(in oklch, #f87171 6%, transparent)",
                  border: "1px solid color-mix(in oklch, #f87171 20%, transparent)",
                }}
              >
                <AlertTriangle size={18} style={{ color: "#f87171" }} className="shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm text-foreground/70">
                  This email appears in known data breaches. Consider updating passwords for the services listed above and enabling two-factor authentication where possible.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
