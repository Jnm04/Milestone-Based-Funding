import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verify as verifyTotp } from "otplib";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Reject obviously oversized inputs before hitting the DB
        if (credentials.email.length > 254 || credentials.password.length > 72) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
          // Constant-time dummy compare to prevent user enumeration timing attacks
          await bcrypt.compare(credentials.password, "$2a$12$invalidhashpadding000000000000000000000000000000000000");
          return null;
        }

        // Check lockout — generic error, do not leak remaining time
        if (user.lockoutUntil && user.lockoutUntil > new Date()) {
          throw new Error("TooManyAttempts");
        }

        if (!user.passwordHash) return null; // Google-only account

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!valid) {
          const newAttempts = user.loginAttempts + 1;
          const lockoutUntil =
            newAttempts >= MAX_LOGIN_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: newAttempts, lockoutUntil },
          });
          return null;
        }

        if (!user.emailVerified) throw new Error("EmailNotVerified");

        // 2FA check — if enabled, require a valid TOTP code
        if (user.totpEnabled && user.totpSecret) {
          const totpCode = (credentials as Record<string, string>).totpCode;
          if (!totpCode) throw new Error("TotpRequired");
          const totpResult = await verifyTotp({ token: totpCode, secret: user.totpSecret });
          const valid = totpResult.valid;
          if (!valid) throw new Error("TotpInvalid");
        }

        // Reset on successful login
        if (user.loginAttempts > 0 || user.lockoutUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockoutUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          walletAddress: user.walletAddress ?? null,
          isEnterprise: user.isEnterprise,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const idFields: Record<string, "googleId" | "githubId" | "linkedinId"> = {
        google: "googleId",
        github: "githubId",
        linkedin: "linkedinId",
      };
      const idField = account?.provider ? idFields[account.provider] : undefined;
      if (!idField) return true; // credentials — allow through
      if (!user.email) return false; // OAuth without email — block

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        if (!existing[idField]) {
          await prisma.user.update({ where: { id: existing.id }, data: { [idField]: account!.providerAccountId } });
        }
        return true;
      }

      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name ?? null,
          passwordHash: null,
          [idField]: account!.providerAccountId,
          role: "INVESTOR",
          emailVerified: true,
        },
      });
      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      if (user && account?.provider && ["google", "github", "linkedin"].includes(account.provider)) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.walletAddress = dbUser.walletAddress ?? null;
          token.isEnterprise = dbUser.isEnterprise;
        }
        return token;
      }
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.walletAddress = (user as unknown as { walletAddress: string | null }).walletAddress;
        token.isEnterprise = (user as unknown as { isEnterprise: boolean }).isEnterprise ?? false;
        return token;
      }
      // Allow updating wallet address via session update
      if (trigger === "update" && session?.walletAddress) {
        token.walletAddress = session.walletAddress;
      }
      // On every token refresh (not fresh login), verify account hasn't been deleted.
      // Account deletion clears passwordHash to "". One primary-key lookup per request.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { passwordHash: true },
        });
        if (!dbUser || dbUser.passwordHash === "") {
          (token as JWT & { accountDeleted: boolean }).accountDeleted = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if ((token as JWT & { accountDeleted?: boolean }).accountDeleted) {
        // Strip user identity — API routes using session.user.id will fail safely.
        // The expired timestamp signals the client to redirect to login.
        session.user.id = "";
        session.user.role = "";
        session.expires = new Date(0).toISOString();
        return session;
      }
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.walletAddress = (token.walletAddress as string | null) ?? null;
      session.user.isEnterprise = (token.isEnterprise as boolean) ?? false;
      return session;
    },
  },
};
