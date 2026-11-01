import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Intelligence & Cyber-Defense Timeline — Email-LookUp",
  description:
    "Audit authentication events, multi-source data breaches, MFA modifications, and guided emergency account lockdown.",
};

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pt-20 min-h-screen">{children}</div>;
}
