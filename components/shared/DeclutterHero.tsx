"use client";

import { useSession, signIn } from "next-auth/react";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  RotateCcw,
  Trash2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

const EXAMPLE_ROWS = [
  {
    name: "Spotify",
    domain: "spotify.com",
    type: "Account",
    typeBg: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
    typeColor: "var(--color-accent)",
    daysAgo: "412 days ago",
    status: "No email 1+ year",
    statusColor: "#9ca3af",
    action: "How to delete",
    isNewsletter: false,
  },
  {
    name: "Duolingo",
    domain: "duolingo.com",
    type: "Account",
    typeBg: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
    typeColor: "var(--color-accent)",
    daysAgo: "128 days ago",
    status: "No email 90+ days",
    statusColor: "#f59e0b",
    action: "How to delete",
    isNewsletter: false,
  },
  {
    name: "Morning Brew",
    domain: "morningbrew.com",
    type: "Newsletter",
    typeBg: "color-mix(in oklch, #818cf8 15%, transparent)",
    typeColor: "#a5b4fc",
    daysAgo: "2 days ago",
    status: "Recent email",
    statusColor: "rgba(255, 255, 255, 0.7)",
    action: "Unsubscribe",
    isNewsletter: true,
  },
  {
    name: "Notion",
    domain: "notion.so",
    type: "Account",
    typeBg: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
    typeColor: "var(--color-accent)",
    daysAgo: "14 days ago",
    status: "Recent email",
    statusColor: "rgba(255, 255, 255, 0.7)",
    action: "—",
    isNewsletter: false,
  },
];

export function DeclutterHero() {
  const { data: session } = useSession();

  function handleCtaClick() {
    if (!session) {
      signIn("google");
    } else {
      const el = document.getElementById("declutter");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <section className="relative pt-32 pb-16 px-6 overflow-hidden" aria-label="Declutter introduction">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] blur-[140px] rounded-full opacity-25"
          style={{ background: "var(--color-accent)" }}
        />
      </div>

      <div className="mx-auto max-w-5xl flex flex-col lg:flex-row items-center justify-between gap-12 relative">
        {/* Left column: Value proposition & CTAs */}
        <div className="flex flex-col gap-6 max-w-xl text-center lg:text-left items-center lg:items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-xs font-mono text-foreground/80 bg-white/5">
            <Sparkles size={13} style={{ color: "var(--color-accent)" }} aria-hidden />
            <span>Digital Footprint Cleaner</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-[1.08]">
            See every account tied to your inbox
          </h1>

          <p className="text-base sm:text-lg text-foreground/70 leading-relaxed max-w-lg">
            Scans your own Gmail headers to list platforms you have accounts with,
            and flags accounts you haven&apos;t heard from in 90+ days.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-2">
            <button
              type="button"
              onClick={handleCtaClick}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200 hover:opacity-90 active:scale-95 flex items-center justify-center gap-2.5 shadow-xl cursor-pointer"
              style={{
                background: "var(--color-accent)",
                color: "#0a0a0a",
              }}
            >
              <span>Scan my mailbox</span>
              <ArrowRight size={16} aria-hidden />
            </button>
          </div>

          {/* 3 Privacy Points under the button */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-2 text-xs text-foreground/60">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={14} style={{ color: "var(--color-accent)" }} aria-hidden />
              <span>Headers only</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Lock size={14} style={{ color: "var(--color-accent)" }} aria-hidden />
              <span>Nothing stored</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <RotateCcw size={14} style={{ color: "var(--color-accent)" }} aria-hidden />
              <span>Revoke anytime</span>
            </div>
          </div>
        </div>

        {/* Right column: Fictional results preview card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full lg:w-[440px] shrink-0"
        >
          <div
            className="rounded-2xl border p-5 sm:p-6 shadow-2xl flex flex-col gap-4 relative"
            style={{
              background: "var(--color-card)",
              borderColor: "color-mix(in oklch, white 12%, transparent)",
            }}
          >
            {/* Card Header with Example preview badge */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">Audit Results</span>
                <span className="text-[11px] text-foreground/40 font-mono">· 4 of 18</span>
              </div>
              <span
                className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/10 font-semibold"
                style={{
                  background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                Example preview
              </span>
            </div>

            {/* Static rows */}
            <div className="flex flex-col gap-2.5">
              {EXAMPLE_ROWS.map((row) => (
                <div
                  key={row.name}
                  className="rounded-xl p-3 border flex items-center justify-between gap-3 text-xs"
                  style={{
                    background: "color-mix(in oklch, white 3%, transparent)",
                    borderColor: "color-mix(in oklch, white 6%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none"
                      style={{
                        background: "color-mix(in oklch, white 8%, transparent)",
                        color: "var(--color-accent)",
                      }}
                    >
                      {row.name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate">
                        {row.name}
                      </span>
                      <span className="text-[10px] font-mono text-foreground/40 truncate">
                        {row.daysAgo}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                      style={{
                        background: row.typeBg,
                        color: row.typeColor,
                      }}
                    >
                      {row.type}
                    </span>

                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: `color-mix(in oklch, ${row.statusColor} 15%, transparent)`,
                        color: row.statusColor,
                      }}
                    >
                      {row.status}
                    </span>

                    {row.action !== "—" ? (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-foreground/50 border border-white/10 px-1.5 py-0.5 rounded">
                        {row.isNewsletter ? <Mail size={10} /> : <Trash2 size={10} />}
                        {row.action}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview footer note */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-foreground/45 font-mono">
              <span>Found 18 accounts</span>
              <span style={{ color: "#fbbf24" }}>6 with no email for 90+ days</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
