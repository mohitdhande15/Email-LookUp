import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscription Radar & Financial Intelligence — Email-LookUp",
  description:
    "Audit recurring SaaS subscriptions, streaming plans, free trial countdowns, and price-hike alerts directly from mailbox metadata.",
};

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pt-20 min-h-screen">{children}</div>;
}
