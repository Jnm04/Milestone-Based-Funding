import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";
import "@/lib/env-validation";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/session-provider";
import { CookieBanner } from "@/components/cookie-banner";
import { SupportChat } from "@/components/support-chat";

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
    canonical: "https://cascrow.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cascrow.com",
    siteName: "Cascrow",
    title: "Cascrow — AI-Powered Escrow on XRPL",
    description:
      "Lock RLUSD in native XRPL escrow. AI verifies milestone completion. Instant trustless settlement — no lawyers, no middlemen.",
    images: [
      {
        url: "https://cascrow.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cascrow — AI-Powered Escrow on XRPL",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@cascrowhq",
    creator: "@cascrowhq",
    title: "Cascrow — AI-Powered Escrow on XRPL",
    description:
      "Lock RLUSD in native XRPL escrow. AI verifies milestone completion. Instant trustless settlement.",
    images: ["https://cascrow.com/opengraph-image"],
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://cascrow.com/#organization",
      name: "Cascrow",
      url: "https://cascrow.com",
      logo: {
        "@type": "ImageObject",
        url: "https://cascrow.com/icon.svg",
      },
      description:
        "Cascrow is an AI-powered escrow platform on the XRP Ledger. It locks RLUSD in a smart contract and releases funds automatically when AI verifies milestone completion — no lawyers, no middlemen.",
      sameAs: [
        "https://cascrow.com",
        "https://twitter.com/cascrowhq",
        "https://www.instagram.com/cascrow",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://cascrow.com/#website",
      url: "https://cascrow.com",
      name: "Cascrow",
      publisher: { "@id": "https://cascrow.com/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://cascrow.com/#app",
      name: "Cascrow",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: "https://cascrow.com",
      description:
        "AI-powered escrow platform on XRPL. Cascrow locks RLUSD in a smart contract on the XRP Ledger EVM sidechain and uses a 5-model AI majority vote to verify milestone completion before releasing funds.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${libreFranklin.variable} dark h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="min-h-full bg-background text-foreground flex flex-col"
        style={{ fontFamily: "var(--font-libre-franklin), var(--font-geist-sans), sans-serif" }}
      >
        <AuthSessionProvider>
          {children}
          <Toaster richColors position="top-right" />
          <CookieBanner />
          <SupportChat />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
