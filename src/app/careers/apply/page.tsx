"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRef, useState, Suspense } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { roles, type RoleType } from "../careers-client";

const primary  = "hsl(22 55% 54%)";
const muted    = "hsl(30 10% 62%)";
const fg       = "hsl(32 35% 92%)";
const border   = "hsl(28 18% 14%)";
const card     = "hsl(24 12% 6% / 0.5)";
const dim      = "hsl(28 10% 28%)";
const inputBg  = "hsl(24 10% 7%)";
const errorCol = "hsl(0 60% 55%)";

const roleNames = roles.map((r) => r.title);

const HEAR_ABOUT_OPTIONS = [
  "Referral",
  "LinkedIn",
  "Instagram",
  "X (Twitter)",
  "Google",
  "cascrow Careers Page",
];

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

type FileField = {
  key: "cv" | "references" | "transcript" | "coverLetter";
  label: string;
  required: boolean;
  hint: string;
};

const FILE_FIELDS: FileField[] = [
  { key: "cv",          label: "CV / Resume",                  required: true,  hint: "PDF or DOCX, max 10 MB" },
  { key: "references",  label: "Work references",              required: false, hint: "PDF or DOCX, max 10 MB" },
  { key: "transcript",  label: "Academic transcript",          required: false, hint: "PDF or DOCX, max 10 MB" },
  { key: "coverLetter", label: "Cover letter",                 required: false, hint: "PDF or DOCX, max 10 MB" },
];

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    background: inputBg,
    border: `1px solid ${focused ? "hsl(22 55% 54% / 0.45)" : border}`,
    color: fg,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: fg }}>
      {children}
      {required && <span style={{ color: primary, marginLeft: 4 }}>*</span>}
    </label>
  );
}

function SectionHead({ title, index }: { title: string; index: number }) {
  return (
    <div className="flex items-center gap-3 mb-5 mt-10 first:mt-0">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: "hsl(22 55% 54% / 0.15)", color: primary, border: `1px solid hsl(22 55% 54% / 0.25)`, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {index}
      </span>
      <h2 className="text-sm font-semibold tracking-wide" style={{ color: fg }}>
        {title}
      </h2>
      <span className="h-px flex-1" style={{ background: border }} />
    </div>
  );
}

function FocusInput({ type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      {...props}
      style={inputStyle(focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function FocusSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      style={{ ...inputStyle(focused), cursor: "pointer" }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  );
}

function FileUpload({
  field,
  value,
  onChange,
}: {
  field: FileField;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      <div
        onClick={() => ref.current?.click()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={0}
        role="button"
        className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-all"
        style={{
          background: inputBg,
          border: `1px solid ${focused ? "hsl(22 55% 54% / 0.45)" : border}`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={value ? primary : dim} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-sm truncate" style={{ color: value ? fg : dim }}>
            {value ? value.name : `Choose file${field.required ? "" : " (optional)"}`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); if (ref.current) ref.current.value = ""; }}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: muted, background: "hsl(28 18% 14%)" }}
            >
              Remove
            </button>
          )}
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: "hsl(28 18% 14%)", color: muted }}>
            Browse
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs" style={{ color: dim }}>{field.hint}</p>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function ApplyForm({ initialRole }: { initialRole: string }) {
  const router = useRouter();

  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
    role: initialRole,
    hearAbout: "",
    referred: false,
    referredBy: "",
    university: "",
    fieldOfStudy: "",
    semester: "",
    gpa: "",
  });

  const [files, setFiles] = useState<Record<string, File | null>>({
    cv: null, references: null, transcript: null, coverLetter: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setFields((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!files.cv) { setError("Please upload your CV."); return; }

    setSubmitting(true);
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
    Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v); });

    try {
      const res = await fetch("/api/careers/apply", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl p-10 text-center flex flex-col items-center gap-5" style={{ background: card, border: `1px solid ${border}` }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "hsl(22 55% 54% / 0.15)", border: `1px solid hsl(22 55% 54% / 0.3)` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: fg }}>Application sent.</h2>
          <p className="text-sm max-w-sm" style={{ color: muted }}>
            We got it. Check your inbox for a confirmation. We review every application and will reach out if it is a good fit.
          </p>
        </div>
        <Link
          href="/careers"
          className="mt-2 text-sm rounded-full px-5 py-2 transition-opacity hover:opacity-80"
          style={{ background: "hsl(28 18% 14%)", color: muted }}
        >
          Back to careers
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      {/* 1. Personal */}
      <SectionHead title="Personal information" index={1} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label required>First name</Label>
          <FocusInput value={fields.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jane" required />
        </div>
        <div>
          <Label required>Last name</Label>
          <FocusInput value={fields.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Doe" required />
        </div>
        <div>
          <Label required>Email address</Label>
          <FocusInput type="email" value={fields.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@example.com" required />
        </div>
        <div>
          <Label required>Gender</Label>
          <FocusSelect value={fields.gender} onChange={(e) => set("gender", e.target.value)} required>
            <option value="">Select...</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </FocusSelect>
        </div>
      </div>

      {/* 2. Role */}
      <SectionHead title="Position" index={2} />
      <div className="flex flex-col gap-4">
        <div>
          <Label required>Role you are applying for</Label>
          <FocusSelect value={fields.role} onChange={(e) => set("role", e.target.value)} required>
            <option value="">Select a role...</option>
            {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
          </FocusSelect>
        </div>
        <div>
          <Label required>How did you hear about this position?</Label>
          <FocusSelect value={fields.hearAbout} onChange={(e) => set("hearAbout", e.target.value)} required>
            <option value="">Select...</option>
            {HEAR_ABOUT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </FocusSelect>
        </div>
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: inputBg, border: `1px solid ${border}` }}>
          <input
            type="checkbox"
            id="referred"
            checked={fields.referred}
            onChange={(e) => set("referred", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded"
            style={{ accentColor: "#C4704B" }}
          />
          <label htmlFor="referred" className="text-sm cursor-pointer select-none" style={{ color: muted }}>
            I was referred by someone at or connected to cascrow
          </label>
        </div>
        {fields.referred && (
          <div>
            <Label>Name of person who referred you</Label>
            <FocusInput value={fields.referredBy} onChange={(e) => set("referredBy", e.target.value)} placeholder="Full name" />
          </div>
        )}
      </div>

      {/* 3. Education */}
      <SectionHead title="Education" index={3} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>University</Label>
          <FocusInput value={fields.university} onChange={(e) => set("university", e.target.value)} placeholder="Technical University of Munich" required />
        </div>
        <div className="sm:col-span-2">
          <Label required>Field of study</Label>
          <FocusInput value={fields.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} placeholder="Computer Science (B.Sc.)" required />
        </div>
        <div>
          <Label required>Semester</Label>
          <FocusInput type="number" min="1" max="20" value={fields.semester} onChange={(e) => set("semester", e.target.value)} placeholder="4" required />
        </div>
        <div>
          <Label required>Current grade average</Label>
          <FocusInput value={fields.gpa} onChange={(e) => set("gpa", e.target.value)} placeholder="2.1 or 3.8 GPA" required />
          <p className="mt-1 text-xs" style={{ color: dim }}>German scale (1.0-4.0) or GPA, whatever applies</p>
        </div>
      </div>

      {/* 4. Documents */}
      <SectionHead title="Documents" index={4} />
      <div className="flex flex-col gap-4">
        {FILE_FIELDS.map((f) => (
          <FileUpload
            key={f.key}
            field={f}
            value={files[f.key]}
            onChange={(file) => setFiles((p) => ({ ...p, [f.key]: file }))}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl px-4 py-3 text-sm" style={{ background: "hsl(0 60% 55% / 0.1)", border: `1px solid hsl(0 60% 55% / 0.25)`, color: errorCol }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs" style={{ color: dim }}>
          Fields marked <span style={{ color: primary }}>*</span> are required.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full px-8 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
            color: "hsl(24 14% 6%)",
          }}
        >
          {submitting ? "Sending..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}

function TypeBadge({ type }: { type: RoleType }) {
  const isEquity = type === "Equity";
  const isFullTime = type === "Full-time";
  return (
    <span
      className="rounded-full px-3 py-0.5 text-xs font-medium"
      style={{
        background: isEquity ? "hsl(22 55% 54% / 0.15)" : isFullTime ? "hsl(140 40% 40% / 0.15)" : "hsl(28 18% 14%)",
        color: isEquity ? primary : isFullTime ? "hsl(140 50% 65%)" : muted,
        border: `1px solid ${isEquity ? "hsl(22 55% 54% / 0.3)" : isFullTime ? "hsl(140 40% 40% / 0.3)" : border}`,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
      }}
    >
      {type}
    </span>
  );
}

function BulletList({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: muted }}>
          <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: accent ? primary : dim }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ApplyContent() {
  const params = useSearchParams();
  const rawRole = params.get("role") ?? "";
  const initialRole = roleNames.includes(rawRole) ? rawRole : "";
  const role = roles.find((r) => r.title === initialRole) ?? null;

  const regularReqs = role?.requirements.filter((r) => !r.startsWith("Bonus:")) ?? [];
  const bonusReqs   = role?.requirements
    .filter((r) => r.startsWith("Bonus:"))
    .map((r) => r.replace(/^Bonus:\s*/, "")) ?? [];

  return (
    <main className="container-tight pt-36 pb-24 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-10 text-sm">
        <Link href="/careers" className="transition-colors hover:text-foreground" style={{ color: muted }}>
          Careers
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dim} strokeWidth={2}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ color: fg }}>{initialRole || "Apply"}</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: primary }}>
            {initialRole || "Open position"}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3" style={{ color: fg }}>
          {initialRole || "Apply at cascrow"}
        </h1>
        {role && (
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <TypeBadge type={role.type} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: dim, letterSpacing: "0.1em" }}>
              {role.duration} · Remote
            </span>
          </div>
        )}
      </div>

      {/* About cascrow */}
      <div className="mb-8 rounded-2xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
        <p
          className="text-xs mb-3"
          style={{ fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.2em", color: dim }}
        >
          About cascrow
        </p>
        <p className="text-sm leading-relaxed" style={{ color: muted }}>
          cascrow is an early-stage startup building the escrow layer for the agent economy. When an AI agent completes a task, cascrow locks funds in a smart contract on the XRPL EVM Sidechain and uses a panel of 5 AI models to verify the work before releasing payment. No intermediaries, no manual approval. We are a small team moving fast and every person here has real impact.
        </p>
      </div>

      {/* Job description */}
      {role && (
        <div className="flex flex-col gap-8 mb-10">
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: fg }}>About the role</p>
            <p className="text-sm leading-relaxed" style={{ color: muted }}>{role.summary}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-3" style={{ color: fg }}>What you will do</p>
            <BulletList items={role.responsibilities} accent />
          </div>

          <div>
            <p className="text-sm font-medium mb-3" style={{ color: fg }}>What we are looking for</p>
            <BulletList items={regularReqs} />
          </div>

          {bonusReqs.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: fg }}>Preferred qualifications</p>
              <p className="text-xs mb-3" style={{ color: dim }}>Nice to have, not required.</p>
              <BulletList items={bonusReqs} />
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-4 mb-10">
        <span className="h-px flex-1" style={{ background: border }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: dim }}>
          Your application
        </span>
        <span className="h-px flex-1" style={{ background: border }} />
      </div>

      {/* Form */}
      <div className="rounded-2xl p-7 sm:p-9" style={{ background: card, border: `1px solid ${border}` }}>
        <ApplyForm initialRole={initialRole} />
      </div>
    </main>
  );
}

export default function ApplyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(24 14% 4%)", color: fg }}>
      <SiteNav />
      <Suspense fallback={null}>
        <ApplyContent />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
