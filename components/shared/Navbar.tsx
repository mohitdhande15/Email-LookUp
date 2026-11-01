"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { content } from "@/lib/content";
import { Sparkles, LogOut, Search, CreditCard } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [navAvatarError, setNavAvatarError] = useState(false);
  const { data: session } = useSession();

  const isDeclutterActive = pathname === "/";
  const isFinancialActive = pathname.startsWith("/financial");
  const isLookupActive = pathname.startsWith("/lookup");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[color-mix(in_oklch,var(--color-background)_85%,transparent)] backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label={`${content.siteName} home`}
        >
          <svg
            width="28"
            height="28"
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
          <span className="font-bold text-sm tracking-tight text-foreground">
            {content.siteName}
          </span>
        </Link>

        {/* Navigation items & Auth */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-medium">
          {/* Declutter (links to /) */}
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${
              isDeclutterActive
                ? "font-semibold shadow-sm"
                : "text-foreground/60 hover:text-foreground hover:bg-white/5 border-transparent"
            }`}
            style={
              isDeclutterActive
                ? {
                    background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                    color: "var(--color-accent)",
                    borderColor: "color-mix(in oklch, var(--color-accent) 35%, transparent)",
                  }
                : undefined
            }
          >
            <Sparkles size={13} style={{ color: "var(--color-accent)" }} aria-hidden />
            <span>Declutter</span>
          </Link>

          {/* Financial Radar (links to /financial) */}
          <Link
            href="/financial"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${
              isFinancialActive
                ? "font-semibold shadow-sm"
                : "text-foreground/60 hover:text-foreground hover:bg-white/5 border-transparent"
            }`}
            style={
              isFinancialActive
                ? {
                    background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                    color: "var(--color-accent)",
                    borderColor: "color-mix(in oklch, var(--color-accent) 35%, transparent)",
                  }
                : undefined
            }
          >
            <CreditCard size={13} aria-hidden />
            <span>Financial</span>
          </Link>

          {/* Lookup (links to /lookup) */}
          <Link
            href="/lookup"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${
              isLookupActive
                ? "font-semibold shadow-sm"
                : "text-foreground/60 hover:text-foreground hover:bg-white/5 border-transparent"
            }`}
            style={
              isLookupActive
                ? {
                    background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                    color: "var(--color-accent)",
                    borderColor: "color-mix(in oklch, var(--color-accent) 35%, transparent)",
                  }
                : undefined
            }
          >
            <Search size={13} aria-hidden />
            <span>Lookup</span>
          </Link>

          {/* User profile / Auth button */}
          {session ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              {session.user?.image && !navAvatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  onError={() => setNavAvatarError(true)}
                  className="size-7 rounded-full object-cover border border-white/10"
                />
              ) : (
                <div
                  className="size-7 rounded-full flex items-center justify-center font-bold text-[10px]"
                  style={{
                    background: "color-mix(in oklch, var(--color-accent) 20%, transparent)",
                    color: "var(--color-accent)",
                  }}
                >
                  {session.user?.name ? session.user.name.slice(0, 1).toUpperCase() : "U"}
                </div>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden sm:inline-flex text-foreground/50 hover:text-foreground transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut size={13} aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-opacity hover:opacity-90 cursor-pointer ml-1"
              style={{
                background: "color-mix(in oklch, var(--color-accent) 15%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
