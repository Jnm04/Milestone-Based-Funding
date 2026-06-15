import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Cascrow <noreply@cascrow.com>";
const JOBS_EMAIL = "jobs@cascrow.com";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

async function uploadFile(
  file: File,
  folder: string,
  applicationId: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File too large: ${file.name}`);
  }
  const ext = file.name.split(".").pop() ?? "pdf";
  const blob = await put(
    `applications/${applicationId}/${folder}.${ext}`,
    file,
    { access: "public" }
  );
  return blob.url;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`careers-apply:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.trim() : "";
  };

  const firstName     = get("firstName");
  const lastName      = get("lastName");
  const email         = get("email");
  const gender        = get("gender");
  const role          = get("role");
  const hearAbout     = get("hearAbout");
  const referred      = get("referred") === "true";
  const referredBy    = get("referredBy") || null;
  const university    = get("university");
  const fieldOfStudy  = get("fieldOfStudy");
  const semesterRaw   = get("semester");
  const gpa           = get("gpa");

  const portfolioUrl      = get("portfolioUrl") || null;
  const cvFile            = formData.get("cv") as File | null;
  const referencesFile    = formData.get("references") as File | null;
  const transcriptFile    = formData.get("transcript") as File | null;
  const coverLetterFile   = formData.get("coverLetter") as File | null;
  const workSampleFile    = formData.get("workSample") as File | null;

  // Validate required fields
  const required = { firstName, lastName, email, gender, role, hearAbout, university, fieldOfStudy, semester: semesterRaw, gpa };
  for (const [key, val] of Object.entries(required)) {
    if (!val) {
      return NextResponse.json({ error: `Missing required field: ${key}` }, { status: 400 });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (!cvFile || cvFile.size === 0) {
    return NextResponse.json({ error: "CV is required." }, { status: 400 });
  }

  const semester = parseInt(semesterRaw, 10);
  if (isNaN(semester) || semester < 1 || semester > 20) {
    return NextResponse.json({ error: "Invalid semester number." }, { status: 400 });
  }

  // Create a placeholder ID for file paths
  const applicationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let cvUrl: string;
  let referencesUrl: string | null = null;
  let transcriptUrl: string | null = null;
  let coverLetterUrl: string | null = null;
  let workSampleUrl: string | null = null;

  try {
    cvUrl = await uploadFile(cvFile, "cv", applicationId);
    if (referencesFile && referencesFile.size > 0) {
      referencesUrl = await uploadFile(referencesFile, "references", applicationId);
    }
    if (transcriptFile && transcriptFile.size > 0) {
      transcriptUrl = await uploadFile(transcriptFile, "transcript", applicationId);
    }
    if (coverLetterFile && coverLetterFile.size > 0) {
      coverLetterUrl = await uploadFile(coverLetterFile, "cover-letter", applicationId);
    }
    if (workSampleFile && workSampleFile.size > 0) {
      workSampleUrl = await uploadFile(workSampleFile, "work-sample", applicationId);
    }
  } catch (err) {
    console.error("[careers/apply] File upload error:", err);
    return NextResponse.json({ error: "File upload failed. Please check file type and size (max 10 MB, PDF or DOCX)." }, { status: 400 });
  }

  let application: { id: string };
  try {
    application = await prisma.jobApplication.create({
      data: {
        firstName,
        lastName,
        email,
        gender,
        role,
        hearAbout,
        referred,
        referredBy,
        university,
        fieldOfStudy,
        semester,
        gpa,
        portfolioUrl,
        cvUrl,
        referencesUrl,
        transcriptUrl,
        coverLetterUrl,
        workSampleUrl,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[careers/apply] DB error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Send confirmation to applicant
  await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: JOBS_EMAIL,
    subject: `Application received: ${role} at Cascrow`,
    html: `
      <div style="background:#161210;color:#ede6dd;font-family:'Inter',sans-serif;max-width:520px;margin:0 auto;padding:48px 40px;border-radius:16px;">
        <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#c4704b;margin:0 0 32px;">cascrow — careers</p>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#ede6dd;">We got your application.</h1>
        <p style="font-size:15px;line-height:1.6;color:#9e8f82;margin:0 0 24px;">
          Hi ${firstName}, thanks for applying for the <strong style="color:#ede6dd;">${role}</strong> position at Cascrow.
          We review every application and will get back to you if we think it is a good fit.
        </p>
        <div style="background:#1e1a17;border:1px solid #2a2420;border-radius:12px;padding:20px 24px;margin:0 0 32px;">
          <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#9e8f82;margin:0 0 12px;">What you submitted</p>
          <table style="font-size:13px;color:#ede6dd;width:100%;border-collapse:collapse;">
            <tr><td style="color:#9e8f82;padding:3px 0;width:40%;">Role</td><td>${role}</td></tr>
            <tr><td style="color:#9e8f82;padding:3px 0;">University</td><td>${university}</td></tr>
            <tr><td style="color:#9e8f82;padding:3px 0;">Field of study</td><td>${fieldOfStudy}</td></tr>
            <tr><td style="color:#9e8f82;padding:3px 0;">Semester</td><td>${semester}</td></tr>
            <tr><td style="color:#9e8f82;padding:3px 0;">CV</td><td>Received</td></tr>
          </table>
        </div>
        <p style="font-size:13px;color:#6b5f56;margin:0;">cascrow.com · AI-verified escrow on XRPL · Application ID: ${application.id}</p>
      </div>
    `,
  }).catch((err) => console.error("[careers/apply] Confirmation email failed:", err));

  // Notify team
  const docs = [
    `CV: ${cvUrl}`,
    referencesUrl  ? `References: ${referencesUrl}` : null,
    transcriptUrl  ? `Transcript: ${transcriptUrl}` : null,
    coverLetterUrl ? `Cover Letter: ${coverLetterUrl}` : null,
    workSampleUrl  ? `Work Sample: ${workSampleUrl}` : null,
  ].filter(Boolean).join("<br>");

  await resend.emails.send({
    from: FROM,
    to: JOBS_EMAIL,
    subject: `New application: ${role} — ${firstName} ${lastName}`,
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;padding:32px;">
        <h2 style="margin:0 0 20px;">New Application: ${role}</h2>
        <table style="font-size:14px;border-collapse:collapse;width:100%;">
          <tr><td style="color:#666;padding:4px 0;width:35%;">Name</td><td><strong>${firstName} ${lastName}</strong></td></tr>
          <tr><td style="color:#666;padding:4px 0;">Email</td><td>${email}</td></tr>
          <tr><td style="color:#666;padding:4px 0;">Gender</td><td>${gender}</td></tr>
          <tr><td style="color:#666;padding:4px 0;">Heard via</td><td>${hearAbout}</td></tr>
          ${referred ? `<tr><td style="color:#666;padding:4px 0;">Referred by</td><td>${referredBy ?? "yes (no name given)"}</td></tr>` : ""}
          <tr><td style="color:#666;padding:4px 0;">University</td><td>${university}</td></tr>
          <tr><td style="color:#666;padding:4px 0;">Field of study</td><td>${fieldOfStudy}</td></tr>
          <tr><td style="color:#666;padding:4px 0;">Semester</td><td>${semester}</td></tr>
          <tr><td style="color:#666;padding:4px 0;">GPA</td><td>${gpa}</td></tr>
          ${portfolioUrl ? `<tr><td style="color:#666;padding:4px 0;">Portfolio / GitHub</td><td><a href="${portfolioUrl}">${portfolioUrl}</a></td></tr>` : ""}
        </table>
        <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;">
          <p style="margin:0 0 8px;font-size:13px;color:#444;font-weight:600;">Documents</p>
          <p style="margin:0;font-size:13px;line-height:1.8;">${docs}</p>
        </div>
        <p style="font-size:12px;color:#999;margin-top:20px;">Application ID: ${application.id}</p>
      </div>
    `,
  }).catch((err) => console.error("[careers/apply] Team email failed:", err));

  return NextResponse.json({ success: true, id: application.id });
}
