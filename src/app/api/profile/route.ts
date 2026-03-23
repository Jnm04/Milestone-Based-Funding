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
      notifyProofSubmitted: true, notifyPendingReview: true, notifyMilestoneCompleted: true,
      notifyFunded: true, notifyVerified: true, notifyRejected: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name, companyName, department, jobTitle, phone, bio, website,
    notifyProofSubmitted, notifyPendingReview, notifyMilestoneCompleted,
    notifyFunded, notifyVerified, notifyRejected,
  } = body;

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
      ...(notifyProofSubmitted !== undefined && { notifyProofSubmitted }),
      ...(notifyPendingReview !== undefined && { notifyPendingReview }),
      ...(notifyMilestoneCompleted !== undefined && { notifyMilestoneCompleted }),
      ...(notifyFunded !== undefined && { notifyFunded }),
      ...(notifyVerified !== undefined && { notifyVerified }),
      ...(notifyRejected !== undefined && { notifyRejected }),
    },
    select: {
      id: true, email: true, name: true, role: true, walletAddress: true,
      companyName: true, department: true, jobTitle: true, phone: true, bio: true, website: true,
      notifyProofSubmitted: true, notifyPendingReview: true, notifyMilestoneCompleted: true,
      notifyFunded: true, notifyVerified: true, notifyRejected: true,
    },
  });

  return NextResponse.json({ user });
}
