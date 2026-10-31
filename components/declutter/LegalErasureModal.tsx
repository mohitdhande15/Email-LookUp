"use client";

import { useState } from "react";
import { ShieldCheck, X, Check, Copy, Send, Mail } from "lucide-react";
import {
  generateLegalErasureNotice,
  type LegalErasureRegulation,
} from "@/lib/legalErasure";
import type { DeclutterPlatform } from "@/components/shared/Declutter";

export interface LegalErasureModalProps {
  platform: DeclutterPlatform;
  userEmail: string;
  regulation: LegalErasureRegulation;
  onRegulationChange: (value: LegalErasureRegulation) => void;
  onClose: () => void;
}

export function LegalErasureModal({
  platform,
  userEmail,
  regulation,
  onRegulationChange,
  onClose,
}: LegalErasureModalProps) {
  const [copied, setCopied] = useState(false);
  const notice = generateLegalErasureNotice({
    serviceName: platform.displayName,
    senderDomain: platform.domain,
    userEmail,
    firstSeenDate: platform.firstSeen,
    lastSeenDate: platform.lastSeen,
    regulation,
  });

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    notice.recipientEmail
  )}&su=${encodeURIComponent(notice.subject)}&body=${encodeURIComponent(notice.body)}`;

  async function copyNotice() {
    try {
      await navigator.clipboard.writeText(notice.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-erasure-title"
    >
      <button
        type="button"
        aria-label="Close legal erasure notice"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: "var(--color-card)",
          borderColor: "color-mix(in oklch, white 14%, transparent)",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-foreground/50">
              <ShieldCheck
                size={15}
                style={{ color: "var(--color-accent)" }}
                aria-hidden
              />
              Legal data erasure generator
            </div>
            <h2
              id="legal-erasure-title"
              className="mt-1 text-xl font-bold text-foreground"
            >
              Request erasure from {platform.displayName}
            </h2>
            <p className="mt-1 text-xs text-foreground/55">
              Draft for review. Does not send anything automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-foreground/60 hover:bg-white/10 hover:text-foreground cursor-pointer"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {/* Statutory tabs */}
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="tablist"
            aria-label="Legal basis"
          >
            {(
              [
                ["COMBINED", "Combined Global", "Multi-Region"],
                ["GDPR_EU", "EU GDPR", "Art 17 (30d)"],
                ["DPDP_INDIA", "India DPDP", "Sec 12(3)"],
                ["CCPA_US", "California CCPA", "§ 1798 (45d)"],
              ] as const
            ).map(([value, label, shortLabel]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={regulation === value}
                onClick={() => onRegulationChange(value)}
                className="rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer"
                style={{
                  background:
                    regulation === value
                      ? "color-mix(in oklch, var(--color-accent) 14%, transparent)"
                      : "color-mix(in oklch, white 4%, transparent)",
                  borderColor:
                    regulation === value
                      ? "color-mix(in oklch, var(--color-accent) 45%, transparent)"
                      : "color-mix(in oklch, white 10%, transparent)",
                }}
              >
                <span className="block text-xs font-semibold text-foreground">
                  {label}
                </span>
                <span className="text-[10px] font-mono text-foreground/50">
                  {shortLabel}
                </span>
              </button>
            ))}
          </div>

          {/* Jurisdictional note */}
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/90 leading-relaxed font-mono">
            ℹ️ {notice.jurisdictionNotes}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-wider text-foreground/45">
                Recipient
              </div>
              <div className="mt-1 break-all text-sm font-mono text-foreground">
                {notice.recipientEmail}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-wider text-foreground/45">
                Subject
              </div>
              <div className="mt-1 text-sm text-foreground">{notice.subject}</div>
            </div>
          </div>

          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-foreground/75 font-mono">
            {notice.body}
          </pre>

          <p className="mt-3 text-[10px] text-foreground/40 italic">
            {notice.disclaimer}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 p-4 md:p-5">
          <button
            type="button"
            onClick={copyNotice}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-white/10 cursor-pointer"
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? "Copied!" : "Copy Notice to Clipboard"}
          </button>
          <a
            href={notice.mailtoUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-white/10"
          >
            <Send size={14} aria-hidden />
            Open in Email Client
          </a>
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-lg hover:opacity-90"
            style={{ background: "var(--color-accent)", color: "#0a0a0a" }}
          >
            <Mail size={14} aria-hidden />
            Open Gmail Compose
          </a>
        </div>
      </div>
    </div>
  );
}
