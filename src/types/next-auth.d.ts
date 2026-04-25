import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      walletAddress: string | null;
      isEnterprise: boolean;
      avatarUrl: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    avatarUrl?: string | null;
    sessionVersion?: number;
  }
}
