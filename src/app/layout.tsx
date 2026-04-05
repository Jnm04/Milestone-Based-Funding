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
  title: "Cascrow — AI Escrow on XRPL",
  description:
    "Lock RLUSD in escrow. AI verifies milestones. Instant trustless settlement on the XRP Ledger.",
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
