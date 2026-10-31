import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Email Lookup - Smart Digital Declutter",
  description:
    "Check publicly available profile information and security breaches across Gravatar, GitHub, and XposedOrNot.",
};

export default function LookupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
