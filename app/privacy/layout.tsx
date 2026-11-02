import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Management & Footprint Defense — Email-LookUp",
  description:
    "One-click unsubscribe engine, California DROP data broker opt-out, statutory legal erasure tracker, and email telemetry inspector.",
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pt-20 min-h-screen">{children}</div>;
}
