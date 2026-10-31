import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { SessionProvider } from "@/components/providers/SessionProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://smartdigitaldeclutter.com"),
  title: {
    default: "Smart Digital Declutter - Mailbox Account Audit",
    template: "%s | Smart Digital Declutter",
  },
  description:
    "See every account tied to your inbox. Scan your own Gmail headers to list platforms and flag accounts with no email in 90+ days.",
  openGraph: {
    title: "Smart Digital Declutter - Mailbox Account Audit",
    description:
      "See every account tied to your inbox. Scan your own Gmail headers to list platforms and flag accounts with no email in 90+ days.",
    url: "https://smartdigitaldeclutter.com",
    siteName: "Smart Digital Declutter",
    images: [{ url: "/og-image.png" }],
    locale: "en_US",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SessionProvider>
          <Navbar />
          {children}
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
