import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Only allow authenticated users to check their own verification status
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ verified: false }, { status: 401 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email || email.length > 254) {
    return NextResponse.json({ verified: false });
  }

  // Only allow checking the session user's own email
  if (session.user.email !== email) {
    return NextResponse.json({ verified: false }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  return NextResponse.json({ verified: user?.emailVerified ?? false });
}
