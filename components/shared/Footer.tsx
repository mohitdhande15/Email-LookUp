import Link from "next/link";
import { content } from "@/lib/content";

export function Footer() {
  return (
    <footer
      className="border-t px-6 py-10"
      style={{ borderColor: "color-mix(in oklch, white 6%, transparent)" }}
    >
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        {/* Logo + name */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label={`${content.siteName} home`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0 transition-transform duration-300 group-hover:rotate-12"
          >
            <rect width="28" height="28" rx="7" fill="var(--color-accent)" />
            <path
              d="M7 14c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7"
              stroke="#0a0a0a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="14" cy="14" r="2.5" fill="#0a0a0a" />
          </svg>
          <span className="font-semibold text-sm text-foreground">
            {content.siteName}
          </span>
        </Link>

        {/* Notes */}
        <div className="flex flex-col gap-1 text-xs text-foreground/40 sm:text-right">
          <span>{content.footer.note}</span>
          <span>{content.footer.disclaimer}</span>
        </div>
      </div>
    </footer>
  );
}
