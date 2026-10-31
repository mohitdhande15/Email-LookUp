"use client";

import { useRef } from "react";
import { Link2, GitBranch, Share2, Users, Globe, Monitor, Smartphone, Music2, MessageSquare, Video } from "lucide-react";
import { content } from "@/lib/content";

const ICON_MAP: Record<string, React.ElementType> = {
  LinkedIn: Link2,
  GitHub: GitBranch,
  Twitter: Share2,
  Facebook: Users,
  Google: Globe,
  Microsoft: Monitor,
  Apple: Smartphone,
  Spotify: Music2,
  Slack: MessageSquare,
  Zoom: Video,
};

const COLOR_MAP: Record<string, string> = {
  LinkedIn: "#0A66C2",
  GitHub: "#c9d1d9",
  Twitter: "#1DA1F2",
  Facebook: "#1877F2",
  Google: "#4285F4",
  Microsoft: "#00A4EF",
  Apple: "#e0e0e0",
  Spotify: "#1DB954",
  Slack: "#4A154B",
  Zoom: "#2D8CFF",
};

function ServiceBadge({ name }: { name: string }) {
  const Icon = ICON_MAP[name] ?? Globe;
  const color = COLOR_MAP[name] ?? "#e0e0e0";
  return (
    <span
      className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border mx-3 text-sm font-medium select-none shrink-0"
      style={{
        borderColor: "color-mix(in oklch, white 10%, transparent)",
        background: "color-mix(in oklch, white 5%, transparent)",
        color: "var(--color-foreground)",
      }}
    >
      <Icon size={15} style={{ color }} />
      {name}
    </span>
  );
}

function Marquee({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="overflow-hidden relative"
      style={{ maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)" }}
    >
      <div
        ref={trackRef}
        className={`flex w-max ${reverse ? "animate-marquee-reverse" : "animate-marquee"} hover:[animation-play-state:paused]`}
      >
        {[...items, ...items].map((name, i) => (
          <ServiceBadge key={`${name}-${i}`} name={name} />
        ))}
      </div>
    </div>
  );
}

export function SupportedServices() {
  return (
    <section id="supported-services" className="py-16 overflow-hidden" aria-label="Supported services">
      <p className="text-center text-sm text-foreground/40 uppercase tracking-widest font-mono mb-8">
        Searches across 10+ platforms
      </p>
      <div className="flex flex-col gap-4">
        <Marquee items={content.services} />
        <Marquee items={[...content.services].reverse()} reverse />
      </div>
    </section>
  );
}
