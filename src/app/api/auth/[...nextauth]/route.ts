import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export function GET(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  // Rate-limit the credentials sign-in endpoint by IP: 20 attempts per 15 min
  const segments = (await ctx.params)?.nextauth ?? [];
  if (segments.join("/") === "callback/credentials") {
    const ip = getClientIp(req);
    if (!checkRateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts. Please wait before trying again." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "900" } }
      );
    }
  }
  return handler(req, ctx);
}
