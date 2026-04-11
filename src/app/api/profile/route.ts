import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { validateName } from "@/lib/validate-name";

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
      kycTier: true, sanctionsStatus: true, sanctionsCheckedAt: true,
      dateOfBirth: true,
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
    dateOfBirth,
  } = body;

  // Input validation — max lengths and strip HTML tags
  const strip = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const trimmed = v.trim().replace(/<[^>]*>/g, "").slice(0, max);
    return trimmed || null;
  };
  const validatedName = strip(name, 100);
  const nameCheck = validateName(validatedName);
  if (!nameCheck.valid) return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
  const validatedCompany = strip(companyName, 100);
  const companyCheck = validateName(validatedCompany, "Company name");
  if (!companyCheck.valid) return NextResponse.json({ error: companyCheck.reason }, { status: 400 });
  const validatedDepartment = strip(department, 100);
  const validatedJobTitle = strip(jobTitle, 100);
  const validatedPhone = strip(phone, 30);
  const validatedBio = strip(bio, 500);
  // Website: only allow http/https URLs
  const rawWebsite = strip(website, 200);
  const validatedWebsite = rawWebsite && /^https?:\/\/.+/.test(rawWebsite) ? rawWebsite : null;

  // Date of birth: optional, must be a valid past date
  let validatedDOB: Date | null | undefined = undefined;
  if (dateOfBirth !== undefined) {
    if (dateOfBirth === null || dateOfBirth === "") {
      validatedDOB = null;
    } else {
      const d = new Date(dateOfBirth);
      validatedDOB = !isNaN(d.getTime()) && d < new Date() ? d : null;
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: validatedName,
      companyName: validatedCompany,
      department: validatedDepartment,
      jobTitle: validatedJobTitle,
      phone: validatedPhone,
      bio: validatedBio,
      website: validatedWebsite,
      ...(notifyProofSubmitted !== undefined && { notifyProofSubmitted }),
      ...(notifyPendingReview !== undefined && { notifyPendingReview }),
      ...(notifyMilestoneCompleted !== undefined && { notifyMilestoneCompleted }),
      ...(notifyFunded !== undefined && { notifyFunded }),
      ...(notifyVerified !== undefined && { notifyVerified }),
      ...(notifyRejected !== undefined && { notifyRejected }),
      ...(validatedDOB !== undefined && { dateOfBirth: validatedDOB }),
    },
    select: {
      id: true, email: true, name: true, role: true, walletAddress: true,
      companyName: true, department: true, jobTitle: true, phone: true, bio: true, website: true,
      notifyProofSubmitted: true, notifyPendingReview: true, notifyMilestoneCompleted: true,
      notifyFunded: true, notifyVerified: true, notifyRejected: true,
      dateOfBirth: true,
    },
  });

  return NextResponse.json({ user });
}
