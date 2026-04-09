import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/session-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-libre-franklin",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cascrow — AI-Powered Escrow on XRPL",
    template: "%s | Cascrow",
  },
  description:
    "Cascrow locks RLUSD in native XRPL escrow and releases funds only when AI verifies milestone completion. Trustless, instant, no middlemen.",
  keywords: [
    "cascrow",
    "xrpl escrow",
    "rlusd escrow",
    "xrpl milestone escrow",
    "ai escrow",
    "xls-85",
    "crypto escrow platform",
    "milestone based funding",
    "trustless escrow",
    "xrp ledger escrow",
    "rlusd",
    "decentralized escrow",
    "smart escrow",
    "startup investor escrow",
  ],
  authors: [{ name: "Cascrow" }],
  creator: "Cascrow",
  metadataBase: new URL("https://cascrow.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cascrow.com",
    siteName: "Cascrow",
    title: "Cascrow — AI-Powered Escrow on XRPL",
    description:
      "Lock RLUSD in native XRPL escrow. AI verifies milestone completion. Instant trustless settlement — no lawyers, no middlemen.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cascrow — AI-Powered Escrow on XRPL",
    description:
      "Lock RLUSD in native XRPL escrow. AI verifies milestone completion. Instant trustless settlement.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${libreFranklin.variable} dark h-full antialiased`}
    >
      <body
        className="min-h-full bg-background text-foreground flex flex-col"
        style={{ fontFamily: "var(--font-libre-franklin), var(--font-geist-sans), sans-serif" }}
      >
        <AuthSessionProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
