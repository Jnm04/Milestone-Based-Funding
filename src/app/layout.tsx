import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/env-validation";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/session-provider";
import { CookieBanner } from "@/components/cookie-banner";
import { SupportChat } from "@/components/support-chat";
import { IdleTimeout } from "@/components/idle-timeout";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter-tight",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cascrow — Agentic Escrow & Verification",
    template: "%s | Cascrow",
  },
  description:
    "Cascrow is agentic escrow and verification for the AI era. Lock RLUSD in a smart contract on XRPL — a 5-model AI majority vote decides release. Native MCP server, REST API, and CLI for agents.",
  keywords: [
    "cascrow",
    "agentic escrow",
    "ai verification",
    "xrpl escrow",
    "rlusd escrow",
    "milestone verification",
    "mcp server",
    "ai agent escrow",
    "trustless escrow",
    "xrp ledger",
    "rlusd",
    "decentralized escrow",
    "smart contract escrow",
    "ai majority vote",
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
    title: "Cascrow — Agentic Escrow & Verification",
    description:
      "Lock RLUSD in a smart contract on XRPL. A 5-model AI majority vote verifies milestones and releases funds automatically. MCP server, REST API, CLI — built for agents.",
    images: [
      {
        url: "https://cascrow.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cascrow — Agentic Escrow & Verification",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@cascrowhq",
    creator: "@cascrowhq",
    title: "Cascrow — Agentic Escrow & Verification",
    description:
      "Agentic escrow on XRPL. 5-model AI majority vote verifies milestones. MCP server, REST API, CLI — no human in the loop required.",
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
        "Cascrow is agentic escrow and verification for the AI era. It locks RLUSD in a smart contract on the XRP Ledger EVM Sidechain and uses a 5-model AI majority vote to verify milestone completion before releasing funds. Native MCP server, REST API, and CLI — built for agents as first-class citizens.",
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
        "Agentic escrow and verification platform on XRPL. Cascrow locks RLUSD in a smart contract on the XRP Ledger EVM Sidechain and uses a 5-model AI majority vote to verify milestone completion before releasing funds. Available via MCP server, REST API, and CLI.",
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
      className={`${interTight.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="min-h-full bg-background text-foreground flex flex-col"
        style={{ fontFamily: "var(--font-inter-tight), 'Inter Tight', system-ui, sans-serif" }}
      >
        <AuthSessionProvider>
          {children}
          <Toaster richColors position="top-right" />
          <IdleTimeout />
          <CookieBanner />
          <SupportChat />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
