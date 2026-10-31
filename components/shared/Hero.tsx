"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Link2,
  GitBranch,
  AlertCircle,
  Building2,
  CheckCircle2,
  X,
  ShieldAlert,
} from "lucide-react";
import { content } from "@/lib/content";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { SourceResult } from "@/lib/sources/types";

/* ── 3 Real Sources Hero Card ────────────────────────────────────── */

const REAL_SOURCES = [
  {
    name: "Gravatar",
    subtitle: "Public avatar & verified accounts",
    icon: Link2,
    color: "#1da1f2",
    status: "Live API",
  },
  {
    name: "GitHub",
    subtitle: "Public developer profile & events",
    icon: GitBranch,
    color: "#c9d1d9",
    status: "Live API",
  },
  {
    name: "XposedOrNot",
    subtitle: "Data breach records lookup",
    icon: ShieldAlert,
    color: "#f87171",
    status: "Free database",
  },
];

const LOOP_MS = 6000;
const HOLD_MS = 1400;
const STEP_MS = (LOOP_MS - HOLD_MS) / REAL_SOURCES.length;

function PublicSourcesCard({ reduced }: { reduced: boolean }) {
  const [visible, setVisible] = useState<number>(reduced ? REAL_SOURCES.length : 0);
  const [progress, setProgress] = useState(reduced ? 100 : 0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const phaseRef = useRef<"counting" | "hold">("counting");

  useEffect(() => {
    if (reduced) return;

    function reset() {
      startRef.current = performance.now();
      phaseRef.current = "counting";
      setVisible(0);
      setProgress(0);
    }

    function frame(now: number) {
      const elapsed = now - startRef.current;

      if (phaseRef.current === "counting") {
        const active = LOOP_MS - HOLD_MS;
        const pct = Math.min((elapsed / active) * 100, 100);
        setProgress(pct);
        const idx = Math.min(Math.floor(elapsed / STEP_MS), REAL_SOURCES.length);
        setVisible(idx);

        if (elapsed >= active) {
          phaseRef.current = "hold";
          startRef.current = now;
        }
      } else {
        setProgress(100);
        if (elapsed >= HOLD_MS) reset();
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    reset();
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  return (
    <div
      className="relative rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background: "var(--color-card)",
        boxShadow:
          "0 0 48px -12px color-mix(in oklch, var(--color-accent) 30%, transparent)",
      }}
      aria-label="Public OSINT sources queried"
      role="img"
    >
      {/* Progress bar */}
      <div
        className="h-1 w-full overflow-hidden"
        style={{ background: "color-mix(in oklch, white 6%, transparent)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "var(--color-accent)",
            transition: "width 80ms linear",
          }}
        />
      </div>

      <div className="p-6">
        {/* Source overview header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-col">
            <span className="font-semibold text-base text-foreground">
              Public Search Engine
            </span>
            <span className="text-xs text-foreground/50 font-mono">
              3 verified open data sources
            </span>
          </div>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-accent font-semibold"
            style={{
              background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            Real-time
          </span>
        </div>

        {/* 3 Real source rows */}
        <div className="flex flex-col gap-2.5" aria-live="polite">
          {REAL_SOURCES.map((s, i) => {
            const Icon = s.icon;
            const shown = reduced ? true : i < visible;
            return (
              <AnimatePresence key={s.name}>
                {shown && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: "color-mix(in oklch, white 4%, transparent)",
                      border: "1px solid color-mix(in oklch, white 8%, transparent)",
                    }}
                  >
                    <div
                      className="size-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "color-mix(in oklch, white 6%, transparent)" }}
                    >
                      <Icon size={16} style={{ color: s.color }} aria-hidden />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground/90 leading-tight">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-foreground/45 truncate">
                        {s.subtitle}
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-foreground/40 hidden sm:inline">
                        {s.status}
                      </span>
                      <CheckCircle2
                        size={14}
                        style={{ color: "var(--color-accent)" }}
                        aria-hidden
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>

        {/* Card footer */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-foreground/40 font-mono">
          <span>Targeted query</span>
          <span style={{ color: "var(--color-accent)" }}>Parallel fetch</span>
        </div>
      </div>
    </div>
  );
}

/* ── Live result card shown on right once search starts ─────────── */

interface LiveCardProps {
  results: SourceResult[];
  searching: boolean;
}

function LiveResultCard({ results, searching }: LiveCardProps) {
  const gravatar = results.find((r) => r.source === "gravatar");
  const github = results.find((r) => r.source === "github");

  const gravatarData = gravatar?.status === "found" ? gravatar.data : null;
  const githubData = github?.status === "found" ? github.data : null;

  const name =
    (gravatarData?.name as string | null) ??
    (githubData?.name as string | null) ??
    null;

  const avatarUrl =
    (gravatarData?.avatarUrl as string | null) ??
    (githubData?.avatarUrl as string | null) ??
    null;

  const company =
    (gravatarData?.company as string | null) ??
    (githubData?.company as string | null) ??
    null;

  return (
    <div
      className="relative rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background: "var(--color-card)",
        boxShadow: "0 0 48px -12px color-mix(in oklch, var(--color-accent) 30%, transparent)",
      }}
      aria-label="Live search result card"
    >
      {/* Progress bar */}
      <div
        className="h-1 w-full overflow-hidden"
        style={{ background: "color-mix(in oklch, white 6%, transparent)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: searching ? `${(results.length / 3) * 66}%` : "100%",
            background: "var(--color-accent)",
          }}
        />
      </div>

      <div className="p-6">
        {/* Avatar + identity */}
        <div className="flex items-start gap-4 mb-5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name ?? "Profile avatar"}
              className="size-14 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="size-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 select-none"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              {name ? name.slice(0, 2).toUpperCase() : "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-lg text-foreground truncate">
              {name ?? "Searching profile…"}
            </p>
            {company && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-foreground/50">
                <Building2 size={11} aria-hidden />
                <span className="truncate">{company}</span>
              </div>
            )}
          </div>
        </div>

        {/* Real source rows */}
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div
              key={r.source}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
              style={{
                background: "color-mix(in oklch, white 4%, transparent)",
                border: "1px solid color-mix(in oklch, white 8%, transparent)",
              }}
            >
              <span className="font-medium capitalize text-foreground/80">{r.source}</span>
              <span
                className="font-mono text-[11px]"
                style={{
                  color:
                    r.status === "found"
                      ? "var(--color-accent)"
                      : r.status === "not_found"
                      ? "#9ca3af"
                      : "#f87171",
                }}
              >
                {r.status === "found"
                  ? "✓ Found"
                  : r.status === "not_found"
                  ? "Not found"
                  : "Error"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hero exported component ───────────────────────────────────────── */

export interface SearchState {
  query: string;
  email: string;
  searching: boolean;
  progress?: number;
  progressLabel?: string;
  results: SourceResult[];
  error?: string;
}

interface HeroProps {
  onSearch: (state: SearchState) => void;
  searchState: SearchState | null;
  onClear: () => void;
}

export function Hero({ onSearch, searchState, onClear }: HeroProps) {
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const isSearching = searchState?.searching ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setLocalError("Please enter an email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    setLocalError(null);

    onSearch({
      query: trimmed,
      email: trimmed,
      searching: true,
      progress: 45,
      progressLabel: "Checking public profiles…",
      results: [],
    });

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        onSearch({
          query: trimmed,
          email: trimmed,
          searching: false,
          results: [],
          error: errData.error ?? `Error: ${res.status}`,
        });
        return;
      }

      const data = await res.json();
      onSearch({
        query: trimmed,
        email: trimmed,
        searching: false,
        progress: 100,
        progressLabel: "Search complete",
        results: data.results ?? [],
      });
    } catch {
      onSearch({
        query: trimmed,
        email: trimmed,
        searching: false,
        results: [],
        error: "Network error occurred. Please try again.",
      });
    }
  }

  return (
    <section id="hero" className="relative pt-32 pb-16 px-6 overflow-hidden">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] blur-[140px] rounded-full opacity-20"
          style={{ background: "var(--color-accent)" }}
        />
      </div>

      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative">
        {/* Left – headline & search box */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="flex flex-col gap-6"
        >
          {/* Badge */}
          <span
            className="inline-flex self-start items-center gap-2 rounded-full px-3 py-1 text-xs font-mono border"
            style={{
              borderColor: "color-mix(in oklch, var(--color-accent) 40%, transparent)",
              color: "var(--color-accent)",
              background: "color-mix(in oklch, var(--color-accent) 8%, transparent)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--color-accent)" }}
              aria-hidden
            />
            {content.hero.badge}
          </span>

          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight text-foreground">
            {content.hero.headline}
          </h1>

          <p className="text-base sm:text-lg text-foreground/60 max-w-md leading-relaxed">
            {content.hero.subheadline}
          </p>

          {/* Search form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none"
                aria-hidden
              />
              <input
                id="hero-email-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (localError) setLocalError(null);
                }}
                placeholder="email@example.com"
                aria-label="Email address to search"
                aria-describedby={localError ? "hero-email-error" : undefined}
                disabled={isSearching}
                className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm focus:outline-none transition-all disabled:opacity-50"
                style={{
                  background: "color-mix(in oklch, white 6%, transparent)",
                  borderColor: localError
                    ? "#f87171"
                    : "color-mix(in oklch, white 12%, transparent)",
                  color: "var(--color-foreground)",
                  fontFamily: "var(--font-mono)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-accent)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor =
                    localError
                      ? "#f87171"
                      : "color-mix(in oklch, white 12%, transparent)")
                }
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              id="hero-search-button"
              className="px-6 py-3 rounded-xl text-sm font-semibold shrink-0 transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_24px_-4px_var(--color-accent)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: "var(--color-accent)", color: "#0a0a0a" }}
            >
              {isSearching ? "Searching…" : content.hero.cta}
            </button>
            {searchState && !isSearching && (
              <button
                type="button"
                onClick={onClear}
                id="hero-clear-button"
                aria-label="Clear search results"
                className="px-4 py-3 rounded-xl text-sm font-semibold shrink-0 transition-all duration-200 hover:opacity-90 active:scale-95 cursor-pointer"
                style={{
                  background: "color-mix(in oklch, white 8%, transparent)",
                  border: "1px solid color-mix(in oklch, white 12%, transparent)",
                  color: "var(--color-foreground)",
                }}
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </form>

          {/* Validation / network error */}
          <AnimatePresence>
            {localError && (
              <motion.p
                id="hero-email-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm"
                style={{ color: "#f87171" }}
              >
                <AlertCircle size={14} aria-hidden />
                {localError}
              </motion.p>
            )}
            {searchState?.error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm"
                style={{ color: "#f87171" }}
              >
                <AlertCircle size={14} aria-hidden />
                {searchState.error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Short notice: Checks 3 public sources */}
          <p className="text-xs text-foreground/60 max-w-md font-medium">
            Checks 3 public sources: Gravatar, GitHub, and the XposedOrNot breach database.
          </p>
        </motion.div>

        {/* Right – 3 public sources card or live search result */}
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto"
        >
          {searchState ? (
            <LiveResultCard
              results={searchState.results}
              searching={searchState.searching}
            />
          ) : (
            <PublicSourcesCard reduced={reduced} />
          )}
        </motion.div>
      </div>
    </section>
  );
}
