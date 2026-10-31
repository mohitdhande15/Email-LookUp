import type { Metadata } from "next";
import { DeclutterHero } from "@/components/shared/DeclutterHero";
import { Declutter } from "@/components/shared/Declutter";

export const metadata: Metadata = {
  title: "Smart Digital Declutter - Mailbox Account Audit",
  description:
    "See every account tied to your inbox. Scan your own Gmail headers to list platforms and flag accounts with no email in 90+ days.",
};

export default function Home() {
  return (
    <main>
      <DeclutterHero />
      <Declutter />
    </main>
  );
}
