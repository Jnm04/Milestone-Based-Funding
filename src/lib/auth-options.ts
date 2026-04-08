import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
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

        // Check lockout
        if (user.lockoutUntil && user.lockoutUntil > new Date()) {
          const remainingMs = user.lockoutUntil.getTime() - Date.now();
          const remainingMin = Math.ceil(remainingMs / 60000);
          throw new Error(`TooManyAttempts:${remainingMin}`);
        }

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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.walletAddress = (user as unknown as { walletAddress: string | null }).walletAddress;
      }
      // Allow updating wallet address via session update
      if (trigger === "update" && session?.walletAddress) {
        token.walletAddress = session.walletAddress;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.walletAddress = (token.walletAddress as string | null) ?? null;
      return session;
    },
  },
};
