import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, email: true, name: true, role: true, walletAddress: true,
      companyName: true, department: true, jobTitle: true, phone: true, bio: true, website: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, companyName, department, jobTitle, phone, bio, website } = body;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name?.trim() || null,
      companyName: companyName?.trim() || null,
      department: department?.trim() || null,
      jobTitle: jobTitle?.trim() || null,
      phone: phone?.trim() || null,
      bio: bio?.trim() || null,
      website: website?.trim() || null,
    },
    select: {
      id: true, email: true, name: true, role: true, walletAddress: true,
      companyName: true, department: true, jobTitle: true, phone: true, bio: true, website: true,
    },
  });

  return NextResponse.json({ user });
}
