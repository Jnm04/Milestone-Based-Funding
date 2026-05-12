import { getServerSession } from "next-auth";
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { authOptions } from "./auth-options";

export { authOptions };

export const getSession = () => getServerSession(authOptions);

// Accepts both NextAuth browser sessions and mobile JWT Bearer tokens.
// Usage: const session = await getMobileSession(req);
//        session?.user.id / session?.user.role
export async function getMobileSession(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      if (!payload.sub || !payload.role) return null;
      return {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          role: payload.role as string,
        },
      };
    } catch {
      return null;
    }
  }
  return getServerSession(authOptions);
}
