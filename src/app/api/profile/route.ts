import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { validateName } from "@/lib/validate-name";
import { screenName, screenWallet } from "@/services/sanctions/sanctions.service";

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
      kycTier: true,
      dateOfBirth: true,
      // Feature 7: public profile
      publicProfile: true,
      publicUsername: true,
      companyBio: true,
      companyWebsite: true,
      linkedinUrl: true,
      verifiedBadgeNftId: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const {
    name, companyName, department, jobTitle, phone, bio, website,
    notifyProofSubmitted, notifyPendingReview, notifyMilestoneCompleted,
    notifyFunded, notifyVerified, notifyRejected,
    dateOfBirth,
    // Feature 7: public profile
    publicProfile, publicUsername, companyBio, companyWebsite, linkedinUrl,
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
      const d = new Date(dateOfBirth as string | number);
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
      ...(notifyProofSubmitted !== undefined && { notifyProofSubmitted: Boolean(notifyProofSubmitted) }),
      ...(notifyPendingReview !== undefined && { notifyPendingReview: Boolean(notifyPendingReview) }),
      ...(notifyMilestoneCompleted !== undefined && { notifyMilestoneCompleted: Boolean(notifyMilestoneCompleted) }),
      ...(notifyFunded !== undefined && { notifyFunded: Boolean(notifyFunded) }),
      ...(notifyVerified !== undefined && { notifyVerified: Boolean(notifyVerified) }),
      ...(notifyRejected !== undefined && { notifyRejected: Boolean(notifyRejected) }),
      ...(validatedDOB !== undefined && { dateOfBirth: validatedDOB }),
      // Feature 7: public profile
      ...(publicProfile !== undefined && { publicProfile: Boolean(publicProfile) }),
      ...(publicUsername !== undefined && {
        publicUsername: typeof publicUsername === "string" && publicUsername.trim()
          ? publicUsername.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 30)
          : null,
      }),
      ...(companyBio !== undefined && { companyBio: typeof companyBio === "string" ? companyBio.slice(0, 500) : null }),
      ...(companyWebsite !== undefined && { companyWebsite: typeof companyWebsite === "string" ? companyWebsite.slice(0, 200) : null }),
      ...(linkedinUrl !== undefined && { linkedinUrl: typeof linkedinUrl === "string" ? linkedinUrl.slice(0, 200) : null }),
    },
    select: {
      id: true, email: true, name: true, role: true, walletAddress: true,
      companyName: true, department: true, jobTitle: true, phone: true, bio: true, website: true,
      notifyProofSubmitted: true, notifyPendingReview: true, notifyMilestoneCompleted: true,
      notifyFunded: true, notifyVerified: true, notifyRejected: true,
      dateOfBirth: true,
      publicProfile: true, publicUsername: true, companyBio: true, companyWebsite: true, linkedinUrl: true, verifiedBadgeNftId: true,
    },
  });

  // Fire-and-forget sanctions recheck if name or DOB changed and tier is still low.
  const nameChanged = name !== undefined && validatedName !== null;
  const dobChanged = validatedDOB !== undefined && validatedDOB !== null;
  if (nameChanged || dobChanged) {
    void (async () => {
      try {
        const fresh = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true, dateOfBirth: true, kycTier: true, walletAddress: true },
        });
        if (!fresh || fresh.kycTier >= 2) return;
        const target = fresh.name ?? fresh.email.split("@")[0];
        const [nameResult, walletResult] = await Promise.all([
          screenName(target, fresh.dateOfBirth ?? null),
          fresh.walletAddress ? screenWallet(fresh.walletAddress) : Promise.resolve({ hit: false, matches: [] }),
        ]);
        const overallHit = nameResult.hit || walletResult.hit;
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            sanctionsCheckedAt: new Date(),
            sanctionsStatus: overallHit ? "HIT" : "CLEAR",
            ...(!overallHit ? { kycTier: Math.max(fresh.kycTier, 1) } : {}),
          },
        });
      } catch (err) {
        console.warn("[profile/recheck] Sanctions recheck failed (non-fatal):", err);
      }
    })();
  }

  return NextResponse.json({ user });
}
