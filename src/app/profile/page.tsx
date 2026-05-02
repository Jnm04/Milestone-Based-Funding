"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

// ── Telegram state ─────────────────────────────────────────────────────────
interface TelegramStatus { configured: boolean; connected: boolean; connectedAt: string | null }

// ── Webhook state ──────────────────────────────────────────────────────────
interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  responseMs: number;
  createdAt: string;
}

const ALL_WEBHOOK_EVENTS = [
  "contract.created", "contract.funded", "contract.expired",
  "proof.submitted", "ai.decision", "manual_review.required",
  "manual_review.resolved", "funds.released", "contract.rejected",
];

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  walletAddress: string | null;
  companyName: string | null;
  department: string | null;
  jobTitle: string | null;
  phone: string | null;
  bio: string | null;
  website: string | null;
  createdAt: string;
  notifyProofSubmitted: boolean;
  notifyPendingReview: boolean;
  notifyMilestoneCompleted: boolean;
  notifyFunded: boolean;
  notifyVerified: boolean;
  notifyRejected: boolean;
  notifyDigest: boolean;
  kycTier: number;
  sanctionsStatus: string | null;
  sanctionsCheckedAt: string | null;
  dateOfBirth: string | null;
  // Feature 7
  publicProfile: boolean;
  publicUsername: string | null;
  companyBio: string | null;
  companyWebsite: string | null;
  linkedinUrl: string | null;
  verifiedBadgeNftId: string | null;
  // Enterprise
  isEnterprise: boolean;
  // Avatar
  avatarUrl: string | null;
}

/* ── Password eye icon ────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Notification toggle ──────────────────────────────────── */
function NotifyToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: "1px solid hsl(22 55% 54% / 0.1)" }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>{label}</span>
        <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="cs-toggle"
        data-checked={checked}
        style={{
          background: checked ? "hsl(22 55% 54%)" : "hsl(28 18% 14%)",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "hsl(32 35% 92%)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transform: checked ? "translateX(20px)" : "translateX(2px)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────── */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-5 rounded-2xl p-6"
      style={{
        background: "hsl(24 12% 6% / 0.5)",
        border: "1px solid hsl(22 55% 54% / 0.15)",
        borderTop: "1px solid #C4704B",
      }}
    >
      <div className="flex flex-col gap-0.5">
        <h2 style={{ color: "hsl(32 35% 92%)", fontFamily: "var(--font-inter-tight)", fontWeight: 500, fontSize: 16 }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function RecheckKycButton({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleRecheck() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/recheck-kyc", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Screening failed. Please try again.");
        return;
      }
      if (data.sanctionsStatus === "CLEAR") {
        toast.success("Sanctions check passed — you are now Tier 1.");
        onSuccess();
      } else {
        toast.error("A potential match was found. Our team will review your account.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
        Tier 1 is granted after sanctions screening. If your account was created before this feature launched, run the check manually.
      </p>
      <button
        type="button"
        onClick={handleRecheck}
        disabled={loading}
        className="cs-btn-ghost cs-btn-sm"
        style={{ alignSelf: "flex-start" }}
      >
        {loading ? "Running check…" : "Run sanctions check now"}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [notifyProofSubmitted, setNotifyProofSubmitted] = useState(true);
  const [notifyPendingReview, setNotifyPendingReview] = useState(true);
  const [notifyMilestoneCompleted, setNotifyMilestoneCompleted] = useState(true);
  const [notifyFunded, setNotifyFunded] = useState(true);
  const [notifyVerified, setNotifyVerified] = useState(true);
  const [notifyRejected, setNotifyRejected] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 2FA / TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupQr, setTotpSetupQr] = useState<string | null>(null);
  const [totpSetupSecret, setTotpSetupSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpDisablePw, setTotpDisablePw] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  // SSO (Feature 1)
  const [ssoConfig, setSsoConfig] = useState<{ provider: string; domain: string; connectionId: string } | null>(null);
  const [ssoProvider, setSsoProvider] = useState("workos");
  const [ssoDomain, setSsoDomain] = useState("");
  const [ssoConnectionId, setSsoConnectionId] = useState("");
  const [savingSso, setSavingSso] = useState(false);

  // Auditor access (Feature 11)
  const [auditorAccesses, setAuditorAccesses] = useState<Array<{ auditorId: string; auditor: { firmName: string; user: { email: string; name: string | null } } }>>([]);
  const [newAuditorEmail, setNewAuditorEmail] = useState("");
  const [addingAuditor, setAddingAuditor] = useState(false);

  // Public profile (Feature 7)
  const [publicProfile, setPublicProfile] = useState(false);
  const [publicUsername, setPublicUsername] = useState("");
  const [companyBio, setCompanyBio] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);

  // Telegram
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);

  // Slack / Teams integrations
  const [slackIntegration, setSlackIntegration] = useState<{ channelName: string | null; events: string[] } | null>(null);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsIntegration, setTeamsIntegration] = useState<{ channelName: string | null; events: string[] } | null>(null);
  const [teamsSaving, setTeamsSaving] = useState(false);
  const [integrationTesting, setIntegrationTesting] = useState<"slack" | "teams" | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [showNewWebhook, setShowNewWebhook] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState<Record<string, WebhookDelivery[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);
  const [expandedDeliveries, setExpandedDeliveries] = useState<string | null>(null);

  // Support tickets
  const [myTickets, setMyTickets] = useState<Array<{
    id: string; subject: string; status: string; priority: string;
    createdAt: string; messages: { role: string; content: string; timestamp?: string }[];
  }>>([]);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Email change
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [emailChangeNew, setEmailChangeNew] = useState("");
  const [emailChangePw, setEmailChangePw] = useState("");
  const [emailChangeSaving, setEmailChangeSaving] = useState(false);
  const [emailChangeSent, setEmailChangeSent] = useState(false);

  // Recovery codes
  const [recoveryCodesCount, setRecoveryCodesCount] = useState<number | null>(null);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(null);
  const [showRecoveryRegen, setShowRecoveryRegen] = useState(false);
  const [recoveryRegenCode, setRecoveryRegenCode] = useState("");
  const [recoveryRegenLoading, setRecoveryRegenLoading] = useState(false);

  // Sessions / login history
  const [sessions, setSessions] = useState<Array<{ id: string; ip: string | null; userAgent: string | null; createdAt: string }>>([]);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);

  // GDPR
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(["contract.funded", "proof.submitted", "ai.decision", "funds.released"]);
  const [whSaving, setWhSaving] = useState(false);
  const [whSecret, setWhSecret] = useState<string | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string }>>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);

  const [activeTab, setActiveTab] = useState<"account" | "security" | "notifications" | "integrations" | "privacy" | "usage">("account");
  const [usageStats, setUsageStats] = useState<{
    contractsAsInvestor: number; contractsAsStartup: number;
    totalMilestones: number; milestonesVerified: number; milestonesCompleted: number;
    milestonesRejected: number; milestonesPending: number;
    proofCount: number; memberSince: string | null;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  function fetchProfile() {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ user }) => {
        setProfile(user);
        setName(user.name ?? "");
        setCompanyName(user.companyName ?? "");
        setDepartment(user.department ?? "");
        setJobTitle(user.jobTitle ?? "");
        setPhone(user.phone ?? "");
        setBio(user.bio ?? "");
        setWebsite(user.website ?? "");
        setNotifyProofSubmitted(user.notifyProofSubmitted);
        setNotifyPendingReview(user.notifyPendingReview);
        setNotifyMilestoneCompleted(user.notifyMilestoneCompleted);
        setNotifyFunded(user.notifyFunded);
        setNotifyVerified(user.notifyVerified);
        setNotifyRejected(user.notifyRejected);
        setNotifyDigest(user.notifyDigest ?? false);
        setDateOfBirth(user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "");
        setPublicProfile(user.publicProfile ?? false);
        setPublicUsername(user.publicUsername ?? "");
        setCompanyBio(user.companyBio ?? "");
        setCompanyWebsite(user.companyWebsite ?? "");
        setLinkedinUrl(user.linkedinUrl ?? "");
        setAvatarUrl(user.avatarUrl ?? null);
      });
  }

  function fetchTotpStatus() {
    fetch("/api/auth/totp").then(r => r.json()).then(d => {
      setTotpEnabled(d.totpEnabled ?? false);
      if (d.totpEnabled) {
        fetch("/api/auth/totp/recovery-codes")
          .then(r => r.json())
          .then(rc => setRecoveryCodesCount(rc.count ?? 0))
          .catch(() => {});
      }
    });
  }

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetchProfile();
    // Load Telegram status
    fetch("/api/telegram/connect")
      .then((r) => r.json())
      .then((d) => setTgStatus(d))
      .catch(() => {});
    fetchTotpStatus();
    // Load SSO config (enterprise only)
    fetch("/api/enterprise/sso")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setSsoConfig(d.config);
          setSsoProvider(d.config.provider);
          setSsoDomain(d.config.domain);
          setSsoConnectionId(d.config.connectionId);
        }
      })
      .catch(() => {});
    // Load auditor accesses (enterprise only)
    fetch("/api/enterprise/auditor-access")
      .then((r) => r.json())
      .then((d) => setAuditorAccesses(d.accesses ?? []))
      .catch(() => {});
    // Load Slack/Teams integrations
    fetch("/api/enterprise/integrations/slack")
      .then((r) => r.json())
      .then((d) => { if (d.integration) setSlackIntegration(d.integration); })
      .catch(() => {});
    fetch("/api/enterprise/integrations/teams")
      .then((r) => r.json())
      .then((d) => { if (d.integration) setTeamsIntegration(d.integration); })
      .catch(() => {});
    // Load API keys
    fetch("/api/enterprise/api-keys")
      .then((r) => r.json())
      .then((d) => setApiKeys(d.keys ?? []))
      .catch(() => {});
    // Load webhooks
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((d) => setWebhooks(d.endpoints ?? []))
      .catch(() => {});
    // Load support tickets
    fetch("/api/support/tickets/mine")
      .then((r) => r.json())
      .then((d) => setMyTickets(d.tickets ?? []))
      .catch(() => {});
    // Load login history
    fetch("/api/user/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.events ?? []))
      .catch(() => {});
  }, [status, router]);

  useEffect(() => {
    if (activeTab !== "usage" || usageStats || loadingUsage) return;
    setLoadingUsage(true);
    fetch("/api/user/usage")
      .then(r => r.json())
      .then(d => setUsageStats(d))
      .catch(() => {})
      .finally(() => setLoadingUsage(false));
  }, [activeTab, usageStats, loadingUsage]);

  async function handleTelegramConnect() {
    setTgLoading(true);
    setTgDeepLink(null);
    try {
      // Auto-register webhook on first connect attempt (idempotent — safe to call multiple times)
      await fetch("/api/telegram/setup-webhook", { method: "POST" });

      const res = await fetch("/api/telegram/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate link");
      setTgDeepLink(data.deepLink);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleRegisterWebhook() {
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram/setup-webhook", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Telegram webhook activated! You can now connect your account.");
      // Reload status
      const s = await fetch("/api/telegram/connect").then((r) => r.json());
      setTgStatus(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate webhook");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleTelegramDisconnect() {
    setTgLoading(true);
    try {
      await fetch("/api/telegram/connect", { method: "DELETE" });
      setTgStatus((prev) => ({ configured: prev?.configured ?? false, connected: false, connectedAt: null }));
      setTgDeepLink(null);
      toast.success("Telegram disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleAddWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!whUrl.startsWith("https://")) { toast.error("URL must start with https://"); return; }
    if (whEvents.length === 0) { toast.error("Select at least one event."); return; }
    setWhSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: whUrl, events: whEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setWebhooks((prev) => [data.endpoint, ...prev]);
      setWhSecret(data.secret);
      setWhUrl("");
      setWhEvents(["contract.funded", "proof.submitted", "ai.decision", "funds.released"]);
      setShowNewWebhook(false);
      toast.success("Webhook added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setWhSaving(false);
    }
  }

  async function handleCreateApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/enterprise/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create API key");
      setApiKeys((prev) => [{ id: data.key.id, name: data.key.name, keyPrefix: data.key.keyPrefix, lastUsedAt: null, createdAt: data.key.createdAt }, ...prev]);
      setNewKeySecret(data.secret);
      setNewKeyName("");
      setShowNewKeyForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteApiKey(id: string) {
    try {
      const res = await fetch(`/api/enterprise/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("API key revoked.");
    } catch {
      toast.error("Failed to revoke API key.");
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook removed.");
    } catch {
      toast.error("Failed to remove webhook.");
    }
  }

  async function handleToggleWebhook(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed");
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w));
    } catch {
      toast.error("Failed to update webhook.");
    }
  }

  async function handleViewDeliveries(id: string) {
    if (expandedDeliveries === id) {
      setExpandedDeliveries(null);
      return;
    }
    setExpandedDeliveries(id);
    if (deliveryHistory[id]) return;
    setLoadingDeliveries(id);
    try {
      const res = await fetch(`/api/webhooks/deliveries?endpointId=${id}`);
      const data = await res.json() as { deliveries?: WebhookDelivery[] };
      setDeliveryHistory((prev) => ({ ...prev, [id]: data.deliveries ?? [] }));
    } catch {
      toast.error("Failed to load delivery history.");
    } finally {
      setLoadingDeliveries(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, department, jobTitle, phone, bio, website, dateOfBirth: dateOfBirth || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password changed.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error changing password.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotify(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyProofSubmitted, notifyPendingReview, notifyMilestoneCompleted,
          notifyFunded, notifyVerified, notifyRejected, notifyDigest,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Notifications saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving settings.");
    } finally {
      setSavingNotify(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const data = await res.json() as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAvatarUrl(data.avatarUrl ?? null);
      toast.success("Avatar updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailChangeSaving(true);
    try {
      const res = await fetch("/api/user/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: emailChangeNew, currentPassword: emailChangePw }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEmailChangeSent(true);
      setEmailChangePw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification.");
    } finally {
      setEmailChangeSaving(false);
    }
  }

  async function handleRegenerateRecoveryCodes(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryRegenLoading(true);
    try {
      const res = await fetch("/api/auth/totp/recovery-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: recoveryRegenCode }),
      });
      const data = await res.json() as { codes?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setFreshRecoveryCodes(data.codes ?? []);
      setRecoveryCodesCount(data.codes?.length ?? 0);
      setShowRecoveryRegen(false);
      setRecoveryRegenCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate codes.");
    } finally {
      setRecoveryRegenLoading(false);
    }
  }

  async function handleRevokeAllSessions() {
    setRevokeAllLoading(true);
    try {
      const res = await fetch("/api/user/sessions", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("All other sessions have been signed out.");
    } catch {
      toast.error("Failed to sign out sessions.");
    } finally {
      setRevokeAllLoading(false);
    }
  }

  async function handleExportData() {
    setExportingData(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cascrow-data-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export data. Please try again.");
    } finally {
      setExportingData(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteConfirmEmail) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete account.");
        return;
      }
      toast.success("Account deleted. You will be signed out.");
      setTimeout(() => signOut({ callbackUrl: "/" }), 1500);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeletingAccount(false);
    }
  }

  const role = (profile?.role ?? session?.user?.role ?? "INVESTOR") as "INVESTOR" | "STARTUP";
  const dashboardHref = role === "INVESTOR" ? "/dashboard/investor" : "/dashboard/startup";
  const initials = (name || profile?.email || "?").slice(0, 2).toUpperCase();

  if (status === "loading" || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(24 14% 4%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(22 55% 54% / 0.4)", borderTopColor: "hsl(22 55% 54%)" }} />
          <span className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(24 14% 4%)", color: "hsl(32 35% 92%)" }}>

      {/* Sidebar */}
      <DashboardSidebar role={role === "INVESTOR" ? "investor" : "startup"} />

      {/* Main */}
      <main className="flex-1 min-w-0">

        {/* Top bar */}
        <div
          className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "hsl(24 14% 4% / 0.92)",
            backdropFilter: "blur(20px)",
            borderBottomColor: "hsl(22 55% 54% / 0.12)",
          }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(30 10% 62%)" }}>
            <Link href={dashboardHref} className="transition-colors hover:text-[#EDE6DD]">Dashboard</Link>
            <span>/</span>
            <span style={{ color: "hsl(32 35% 92%)" }}>Profile</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs transition-colors"
            style={{ color: "hsl(30 10% 62%)" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "hsl(32 35% 92%)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "hsl(30 10% 62%)")}
          >
            Sign out
          </button>
        </div>

        <div className="max-w-2xl mx-auto py-10 px-6 flex flex-col gap-8">

          {/* Avatar + header */}
          <div className="flex items-center gap-5">
            <div
              style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
              onClick={() => avatarInputRef.current?.click()}
              title="Change avatar"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: "1px solid hsl(22 55% 54% / 0.3)", display: "block" }}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-semibold"
                  style={{
                    background: "hsl(22 55% 54% / 0.15)",
                    border: "1px solid hsl(22 55% 54% / 0.3)",
                    color: "hsl(22 55% 54%)",
                    fontFamily: "var(--font-inter-tight)",
                  }}
                >
                  {initials}
                </div>
              )}
              <div style={{ position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: "50%", background: "hsl(22 55% 54%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              {avatarUploading && (
                <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(22 55% 54% / 0.4)", borderTopColor: "hsl(22 55% 54%)" }} />
                </div>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
            </div>
            <div className="flex flex-col gap-1">
              <h1
                style={{
                  fontFamily: "var(--font-inter-tight), sans-serif",
                  fontWeight: 300,
                  fontSize: "clamp(22px, 4vw, 30px)",
                  color: "hsl(32 35% 92%)",
                }}
              >
                {name || profile.email}
              </h1>
              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest self-start"
                style={{
                  background: "hsl(22 55% 54% / 0.1)",
                  border: "1px solid hsl(22 55% 54% / 0.25)",
                  color: "hsl(22 55% 54%)",
                }}
              >
                {role === "INVESTOR" ? "Grant Giver" : "Receiver"}
              </span>
            </div>
          </div>

          {/* ── Tab navigation ─────────────────────────────────────────────────── */}
          <div className="flex border-b" style={{ borderColor: "hsl(22 55% 54% / 0.15)" }}>
            {([
              { id: "account", label: "Account" },
              { id: "security", label: "Security" },
              { id: "notifications", label: "Notifications" },
              { id: "integrations", label: "Integrations" },
              { id: "privacy", label: "Privacy" },
              { id: "usage", label: "Usage" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === tab.id ? "hsl(32 35% 92%)" : "hsl(30 10% 62%)",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid #C4704B" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══ ACCOUNT ══════════════════════════════════════════════════════════ */}
          {activeTab === "account" && <>

          {/* Verification / KYC */}
          <SectionCard title="Verification" subtitle="Your identity verification level determines your contract limits.">
            {(() => {
              const tier = profile.kycTier ?? 0;
              const tiers = [
                { tier: 0, label: "Email verified", limit: "$1,000", status: tier >= 0 ? "active" : "locked" },
                { tier: 1, label: "Name + Sanctions screening", limit: "$10,000", status: tier >= 1 ? "active" : "pending" },
                { tier: 2, label: "ID + Liveness check", limit: "$100,000", status: "coming_soon" },
                { tier: 3, label: "KYB + Source of funds", limit: "Unlimited", status: "coming_soon" },
              ];
              return (
                <div className="flex flex-col gap-4">
                  {/* Current tier badge */}
                  <div className="flex items-center gap-3">
                    <div
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                      style={{ background: "hsl(22 55% 54% / 0.15)", border: "1px solid hsl(22 55% 54% / 0.3)", color: "hsl(22 55% 54%)" }}
                    >
                      Tier {tier}
                    </div>
                    <span className="text-sm" style={{ color: "hsl(32 35% 92%)" }}>
                      {tier === 0 && "Email verified — up to $1,000 per contract"}
                      {tier === 1 && "Sanctions cleared — up to $10,000 per contract"}
                      {tier >= 2 && `Verified — up to ${tiers[tier]?.limit ?? "Unlimited"} per contract`}
                    </span>
                    {profile.sanctionsStatus === "CLEAR" && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}
                      >
                        Sanctions: Clear
                      </span>
                    )}
                    {profile.sanctionsStatus === "HIT" && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}
                      >
                        Sanctions: Review required
                      </span>
                    )}
                  </div>

                  {/* Tier list */}
                  <div className="flex flex-col gap-2">
                    {tiers.map((t) => {
                      const isActive = tier >= t.tier && t.status !== "coming_soon";
                      const isCurrent = tier === t.tier;
                      const isComingSoon = t.status === "coming_soon";
                      return (
                        <div
                          key={t.tier}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{
                            background: isCurrent ? "hsl(22 55% 54% / 0.08)" : "hsl(24 12% 6% / 0.3)",
                            border: isCurrent ? "1px solid hsl(22 55% 54% / 0.25)" : "1px solid transparent",
                            opacity: isComingSoon ? 0.5 : 1,
                          }}
                        >
                          {/* Check / dot */}
                          <div style={{ width: 18, height: 18, flexShrink: 0 }}>
                            {isActive ? (
                              <svg viewBox="0 0 18 18" fill="none">
                                <circle cx="9" cy="9" r="9" fill="rgba(52,211,153,0.15)" />
                                <path d="M5 9l3 3 5-5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 18 18" fill="none">
                                <circle cx="9" cy="9" r="8.5" stroke="rgba(168,155,140,0.3)" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-bold w-12 shrink-0" style={{ color: "hsl(22 55% 54%)" }}>Tier {t.tier}</span>
                          <span className="text-xs flex-1" style={{ color: "hsl(30 10% 62%)" }}>{t.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-medium" style={{ color: "hsl(32 35% 92%)" }}>{t.limit}</span>
                            {isCurrent && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "hsl(22 55% 54% / 0.15)", color: "hsl(22 55% 54%)" }}>
                                Current
                              </span>
                            )}
                            {isComingSoon && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(168,155,140,0.08)", color: "hsl(30 10% 62%)" }}>
                                Coming soon
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {tier < 1 && profile.sanctionsStatus !== "CLEAR" && (
                    <RecheckKycButton onSuccess={() => fetchProfile()} />
                  )}
                </div>
              );
            })()}
          </SectionCard>

          {/* Profile Information */}
          <SectionCard title="Profile Information" subtitle="Your personal and professional details">

            <div className="flex flex-col gap-2">
              <label className="cs-label">Email</label>
              <div
                className="px-3 py-2.5 rounded-xl text-sm font-mono"
                style={{
                  background: "hsl(24 12% 6% / 0.5)",
                  border: "1px solid hsl(22 55% 54% / 0.1)",
                  color: "hsl(30 10% 62%)",
                }}
              >
                {profile.email}
              </div>
              {!showEmailChange ? (
                <button type="button" onClick={() => setShowEmailChange(true)} className="cs-btn-ghost cs-btn-sm self-start">
                  Change email
                </button>
              ) : emailChangeSent ? (
                <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#86efac" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Verification sent to <strong>{emailChangeNew}</strong>. Click the link in that email to confirm.</span>
                </div>
              ) : (
                <form onSubmit={handleChangeEmail} className="flex flex-col gap-3 p-3 rounded-xl" style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.12)" }}>
                  <div className="flex flex-col gap-1.5">
                    <label className="cs-label">New email address</label>
                    <input type="email" value={emailChangeNew} onChange={e => setEmailChangeNew(e.target.value)} placeholder="new@example.com" className="cs-input" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="cs-label">Current password</label>
                    <input type="password" value={emailChangePw} onChange={e => setEmailChangePw(e.target.value)} placeholder="••••••••" className="cs-input" autoComplete="current-password" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={emailChangeSaving || !emailChangeNew} className="cs-btn-ghost cs-btn-sm">
                      {emailChangeSaving ? "Sending…" : "Send verification email"}
                    </button>
                    <button type="button" onClick={() => { setShowEmailChange(false); setEmailChangeNew(""); setEmailChangePw(""); }} className="cs-btn-ghost cs-btn-sm" style={{ opacity: 0.6 }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Position / Title</label>
                  <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="CEO, CFO, Founder…" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Department</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Finance, Engineering…" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">
                    Date of birth <span style={{ color: "hsl(30 10% 62%)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="cs-input"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Website</label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="cs-input" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="cs-label">About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Short description…"
                  rows={3}
                  className="cs-input resize-none"
                  style={{ height: "auto" }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="cs-label">EVM Wallet (MetaMask)</label>
                <div
                  className="px-3 py-2.5 rounded-xl text-xs font-mono break-all"
                  style={{
                    background: "hsl(24 12% 6% / 0.5)",
                    border: "1px solid hsl(22 55% 54% / 0.1)",
                    color: profile.walletAddress ? "hsl(32 35% 92%)" : "hsl(30 10% 62%)",
                  }}
                >
                  {profile.walletAddress ?? "No wallet connected yet"}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "hsl(30 10% 62%)" }}>Connect via the dashboard.</p>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="cs-btn-primary cs-btn-sm">
                  {saving ? "Saving…" : "Save Profile"}
                </button>
              </div>
            </form>
          </SectionCard>

          </>}

          {/* ══ NOTIFICATIONS ════════════════════════════════════════════════════ */}
          {activeTab === "notifications" && <>

          {/* Email Notifications */}
          <SectionCard title="Email Notifications" subtitle="Choose when you want to be notified by email">
            <div className="flex flex-col">
              {role === "INVESTOR" && (
                <>
                  <NotifyToggle label="Proof submitted" description="Receiver has submitted proof for a milestone" checked={notifyProofSubmitted} onChange={setNotifyProofSubmitted} />
                  <NotifyToggle label="Manual review required" description="The AI is uncertain — your assessment is needed" checked={notifyPendingReview} onChange={setNotifyPendingReview} />
                  <NotifyToggle label="Milestone completed" description="Payment has been successfully released" checked={notifyMilestoneCompleted} onChange={setNotifyMilestoneCompleted} />
                </>
              )}
              {role === "STARTUP" && (
                <>
                  <NotifyToggle label="Milestone funded" description="A Grant Giver has funded your milestone with RLUSD" checked={notifyFunded} onChange={setNotifyFunded} />
                  <NotifyToggle label="Proof approved" description="AI accepted your proof — payment is being released" checked={notifyVerified} onChange={setNotifyVerified} />
                  <NotifyToggle label="Proof rejected" description="AI rejected your proof — resubmission is possible" checked={notifyRejected} onChange={setNotifyRejected} />
                </>
              )}
              <div style={{ paddingTop: 8, borderTop: "1px solid hsl(22 55% 54% / 0.12)", marginTop: 4 }}>
                <NotifyToggle
                  label="Daily digest mode"
                  description="Receive a single daily summary email instead of one email per event"
                  checked={notifyDigest}
                  onChange={setNotifyDigest}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleSaveNotifications} disabled={savingNotify} className="cs-btn-ghost cs-btn-sm">
                {savingNotify ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </SectionCard>

          </>}

          {/* ══ SECURITY ═════════════════════════════════════════════════════════ */}
          {activeTab === "security" && <>

          {/* Change Password */}
          <SectionCard title="Change Password">
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="cs-label">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="cs-input"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(30 10% 62%)" }} tabIndex={-1}>
                    <EyeIcon open={showCurrent} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">New Password</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="cs-input" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(30 10% 62%)" }} tabIndex={-1}>
                      <EyeIcon open={showNew} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="cs-input" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(30 10% 62%)" }} tabIndex={-1}>
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingPw} className="cs-btn-ghost cs-btn-sm">
                  {savingPw ? "Changing…" : "Change Password"}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Two-Factor Authentication */}
          <SectionCard title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account.">
            {totpEnabled ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-sm font-medium" style={{ color: "#86efac" }}>2FA is enabled</span>
                </div>
                {!showDisable2FA ? (
                  <button onClick={() => setShowDisable2FA(true)} className="cs-btn-ghost cs-btn-sm" style={{ alignSelf: "flex-start" }}>Disable 2FA</button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Enter your password and current 2FA code to disable two-factor authentication.</p>
                    <input type="password" value={totpDisablePw} onChange={e => setTotpDisablePw(e.target.value)} placeholder="Current password" className="cs-input" />
                    <input type="text" inputMode="numeric" maxLength={6} value={totpDisableCode} onChange={e => setTotpDisableCode(e.target.value.replace(/\D/g,""))} placeholder="6-digit code" className="cs-input" style={{ letterSpacing: "0.25em" }} />
                    <div className="flex gap-2">
                      <button
                        disabled={totpLoading || totpDisablePw.length < 1 || totpDisableCode.length !== 6}
                        onClick={async () => {
                          setTotpLoading(true);
                          try {
                            const r = await fetch("/api/auth/totp", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: totpDisablePw, code: totpDisableCode }) });
                            const d = await r.json() as { ok?: boolean; error?: string };
                            if (!r.ok) { toast.error(d.error ?? "Failed"); return; }
                            toast.success("2FA disabled");
                            setTotpEnabled(false); setShowDisable2FA(false); setTotpDisablePw(""); setTotpDisableCode("");
                            setRecoveryCodesCount(null); setFreshRecoveryCodes(null);
                          } finally { setTotpLoading(false); }
                        }}
                        className="cs-btn-ghost cs-btn-sm"
                        style={{ color: "#ef4444" }}
                      >
                        {totpLoading ? "Disabling…" : "Confirm disable"}
                      </button>
                      <button onClick={() => setShowDisable2FA(false)} className="cs-btn-ghost cs-btn-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Recovery codes */}
                {freshRecoveryCodes ? (
                  <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: "hsl(22 55% 54% / 0.06)", border: "1px solid hsl(22 55% 54% / 0.2)" }}>
                    <p className="text-sm font-semibold" style={{ color: "hsl(32 35% 92%)" }}>Save your recovery codes</p>
                    <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>These 10 codes can each be used once to sign in if you lose access to your authenticator app. Store them somewhere safe — they won&apos;t be shown again.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {freshRecoveryCodes.map((c) => (
                        <code key={c} className="px-3 py-1.5 rounded-lg text-center text-sm font-mono" style={{ background: "hsl(24 12% 6% / 0.7)", color: "hsl(32 35% 92%)", letterSpacing: "0.1em" }}>{c}</code>
                      ))}
                    </div>
                    <button type="button" onClick={() => setFreshRecoveryCodes(null)} className="cs-btn-ghost cs-btn-sm self-start">
                      I&apos;ve saved my codes
                    </button>
                  </div>
                ) : recoveryCodesCount !== null && (
                  <div className="flex items-center justify-between gap-4 py-3" style={{ borderTop: "1px solid hsl(22 55% 54% / 0.1)" }}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Recovery codes</span>
                      <span className="text-xs" style={{ color: recoveryCodesCount === 0 ? "#f87171" : "hsl(30 10% 62%)" }}>
                        {recoveryCodesCount === 0 ? "All codes used — regenerate now" : `${recoveryCodesCount} of 10 remaining`}
                      </span>
                    </div>
                    {!showRecoveryRegen ? (
                      <button type="button" onClick={() => setShowRecoveryRegen(true)} className="cs-btn-ghost cs-btn-sm shrink-0">
                        Regenerate
                      </button>
                    ) : (
                      <form onSubmit={handleRegenerateRecoveryCodes} className="flex gap-2 items-center">
                        <input type="text" inputMode="numeric" maxLength={6} value={recoveryRegenCode} onChange={e => setRecoveryRegenCode(e.target.value.replace(/\D/g,""))} placeholder="Current code" className="cs-input" style={{ width: 110, letterSpacing: "0.15em" }} />
                        <button type="submit" disabled={recoveryRegenLoading || recoveryRegenCode.length !== 6} className="cs-btn-ghost cs-btn-sm shrink-0">
                          {recoveryRegenLoading ? "…" : "Confirm"}
                        </button>
                        <button type="button" onClick={() => { setShowRecoveryRegen(false); setRecoveryRegenCode(""); }} className="cs-btn-ghost cs-btn-sm shrink-0" style={{ opacity: 0.6 }}>Cancel</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : totpSetupQr ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to activate.</p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={totpSetupQr} alt="2FA QR code" style={{ width: 180, height: 180, borderRadius: 8 }} />
                </div>
                <p className="text-xs text-center" style={{ color: "hsl(30 10% 62%)" }}>Manual entry key: <code style={{ color: "hsl(32 35% 92%)" }}>{totpSetupSecret}</code></p>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,""))}
                  placeholder="000000" className="cs-input"
                  style={{ letterSpacing: "0.25em", fontSize: 20, textAlign: "center" }}
                />
                <div className="flex gap-2">
                  <button
                    disabled={totpLoading || totpCode.length !== 6}
                    onClick={async () => {
                      setTotpLoading(true);
                      try {
                        const r = await fetch("/api/auth/totp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode }) });
                        const d = await r.json() as { ok?: boolean; error?: string; recoveryCodes?: string[] };
                        if (!r.ok) { toast.error(d.error ?? "Invalid code"); setTotpCode(""); return; }
                        toast.success("2FA enabled!");
                        setTotpEnabled(true); setTotpSetupQr(null); setTotpSetupSecret(null); setTotpCode("");
                        if (d.recoveryCodes) { setFreshRecoveryCodes(d.recoveryCodes); setRecoveryCodesCount(d.recoveryCodes.length); }
                      } finally { setTotpLoading(false); }
                    }}
                    className="cs-btn-primary"
                  >
                    {totpLoading ? "Verifying…" : "Activate 2FA"}
                  </button>
                  <button onClick={() => { setTotpSetupQr(null); setTotpSetupSecret(null); setTotpCode(""); }} className="cs-btn-ghost cs-btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Protect your account with a time-based one-time password (TOTP) from your phone.</p>
                <button
                  disabled={totpLoading}
                  onClick={async () => {
                    setTotpLoading(true);
                    try {
                      const r = await fetch("/api/auth/totp", { method: "POST" });
                      const d = await r.json() as { qrDataUrl?: string; secret?: string; error?: string };
                      if (!r.ok) { toast.error(d.error ?? "Failed"); return; }
                      setTotpSetupQr(d.qrDataUrl ?? null);
                      setTotpSetupSecret(d.secret ?? null);
                    } finally { setTotpLoading(false); }
                  }}
                  className="cs-btn-ghost cs-btn-sm"
                  style={{ alignSelf: "flex-start" }}
                >
                  {totpLoading ? "Generating…" : "Set up 2FA"}
                </button>
              </div>
            )}
          </SectionCard>

          </>}

          {/* ══ INTEGRATIONS ═════════════════════════════════════════════════════ */}
          {activeTab === "integrations" && <>

          {/* SSO / SAML (enterprise only) */}
          {profile?.isEnterprise && (
            <SectionCard title="Single Sign-On" subtitle="Allow team members to log in with their company credentials (Okta, Azure AD, Google Workspace).">
              {ssoConfig ? (
                <div className="flex flex-col gap-3">
                  <div
                    className="rounded-lg px-4 py-3 flex items-center justify-between"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "#86efac" }}>SSO Enabled</span>
                      <span className="text-xs ml-2" style={{ color: "hsl(30 10% 62%)" }}>@{ssoConfig.domain} · {ssoConfig.provider}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/enterprise/sso", { method: "DELETE" });
                        setSsoConfig(null);
                        setSsoConnectionId("");
                        setSsoDomain("");
                        toast.success("SSO disabled");
                      }}
                      className="text-xs"
                      style={{ color: "#ef4444" }}
                    >
                      Disable
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    Team members with @{ssoConfig.domain} email addresses will be redirected to your identity provider on login.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingSso(true);
                    try {
                      const res = await fetch("/api/enterprise/sso", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ provider: ssoProvider, connectionId: ssoConnectionId.trim(), domain: ssoDomain.trim() }),
                      });
                      const d = await res.json() as { error?: string; config?: typeof ssoConfig };
                      if (!res.ok) throw new Error(d.error ?? "Failed");
                      setSsoConfig(d.config!);
                      toast.success("SSO configured");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to save SSO config");
                    } finally {
                      setSavingSso(false);
                    }
                  }}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>Provider</label>
                    <select
                      value={ssoProvider}
                      onChange={(e) => setSsoProvider(e.target.value)}
                      className="cs-input w-full"
                    >
                      <option value="workos">WorkOS (recommended)</option>
                      <option value="saml">Generic SAML 2.0</option>
                      <option value="oidc">Generic OIDC</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>Company email domain</label>
                    <input type="text" value={ssoDomain} onChange={(e) => setSsoDomain(e.target.value)} placeholder="bmw.de" className="cs-input w-full" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>
                      {ssoProvider === "workos" ? "WorkOS Connection ID" : "SAML Metadata URL / OIDC Issuer"}
                    </label>
                    <input type="text" value={ssoConnectionId} onChange={(e) => setSsoConnectionId(e.target.value)} placeholder={ssoProvider === "workos" ? "conn_..." : "https://..."} className="cs-input w-full" required />
                  </div>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    Configure your identity provider first, then paste the connection ID here. Contact cascrow support if you need help setting up WorkOS.
                  </p>
                  <button type="submit" disabled={savingSso || !ssoDomain || !ssoConnectionId} className="cs-btn cs-btn-sm" style={{ alignSelf: "flex-start" }}>
                    {savingSso ? "Saving…" : "Enable SSO"}
                  </button>
                </form>
              )}
            </SectionCard>
          )}

          {/* Auditor Access (enterprise only) */}
          {profile?.isEnterprise && (
            <SectionCard title="Auditor Access" subtitle="Grant read-only access to registered audit firm partners (KPMG, Deloitte, PwC, EY).">
              <div className="flex flex-col gap-3">
                {auditorAccesses.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {auditorAccesses.map((access) => (
                      <div
                        key={access.auditorId}
                        className="flex items-center justify-between rounded-lg px-4 py-3"
                        style={{ background: "hsl(24 12% 6% / 0.6)", border: "1px solid hsl(28 18% 14% / 0.8)" }}
                      >
                        <div>
                          <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>{access.auditor.firmName}</span>
                          <span className="text-xs ml-2" style={{ color: "hsl(30 10% 62%)" }}>{access.auditor.user.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/enterprise/auditor-access/${access.auditorId}`, { method: "DELETE" });
                            setAuditorAccesses((prev) => prev.filter((a) => a.auditorId !== access.auditorId));
                            toast.success("Auditor access revoked");
                          }}
                          className="text-xs"
                          style={{ color: "#ef4444" }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newAuditorEmail.trim()) return;
                    setAddingAuditor(true);
                    try {
                      const res = await fetch("/api/enterprise/auditor-access", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ auditorEmail: newAuditorEmail.trim() }),
                      });
                      const d = await res.json() as { error?: string; access?: typeof auditorAccesses[0] };
                      if (!res.ok) throw new Error(d.error ?? "Failed");
                      if (d.access) setAuditorAccesses((prev) => [...prev, d.access!]);
                      setNewAuditorEmail("");
                      toast.success("Auditor access granted");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to grant access");
                    } finally {
                      setAddingAuditor(false);
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    value={newAuditorEmail}
                    onChange={(e) => setNewAuditorEmail(e.target.value)}
                    placeholder="auditor@kpmg.com"
                    className="cs-input flex-1"
                    required
                  />
                  <button type="submit" disabled={addingAuditor || !newAuditorEmail.trim()} className="cs-btn cs-btn-sm">
                    {addingAuditor ? "Adding…" : "Grant Access"}
                  </button>
                </form>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>The auditor must have a registered cascrow auditor partner account. Contact cascrow support to register your audit firm.</p>
              </div>
            </SectionCard>
          )}

          </>}

          {/* Public Profile (startup only — account tab) */}
          {activeTab === "account" && profile?.role === "STARTUP" && (
            <SectionCard title="Public Profile" subtitle="Show your verified track record to investors. Opt in to make your profile discoverable.">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingPublicProfile(true);
                  try {
                    const res = await fetch("/api/profile", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ publicProfile, publicUsername: publicUsername.trim() || null, companyBio: companyBio.trim() || null, companyWebsite: companyWebsite.trim() || null, linkedinUrl: linkedinUrl.trim() || null }),
                    });
                    if (!res.ok) {
                      const d = await res.json() as { error?: string };
                      throw new Error(d.error ?? "Save failed");
                    }
                    toast.success("Public profile saved");
                    if (publicProfile && publicUsername) {
                      window.open(`/startup/${publicUsername.toLowerCase()}`, "_blank");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error saving profile");
                  } finally {
                    setSavingPublicProfile(false);
                  }
                }}
                className="flex flex-col gap-4"
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setPublicProfile((v) => !v)}
                    className="relative"
                    style={{ width: 44, height: 24, borderRadius: 12, background: publicProfile ? "hsl(22 55% 54%)" : "hsl(28 18% 14%)", transition: "background 0.2s", cursor: "pointer", flexShrink: 0 }}
                  >
                    <div style={{ position: "absolute", top: 3, left: publicProfile ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Make profile public</span>
                </label>

                {publicProfile && (
                  <>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>Username (cascrow.com/startup/your-username)</label>
                      <input type="text" value={publicUsername} onChange={(e) => setPublicUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))} placeholder="your-startup" maxLength={30} className="cs-input w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>Company bio</label>
                      <textarea value={companyBio} onChange={(e) => setCompanyBio(e.target.value)} placeholder="What does your startup do?" maxLength={500} rows={3} className="cs-input w-full resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>Website</label>
                        <input type="url" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://yoursite.com" className="cs-input w-full" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: "hsl(30 10% 62%)" }}>LinkedIn</label>
                        <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." className="cs-input w-full" />
                      </div>
                    </div>
                    {publicUsername && (
                      <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                        Public URL: <a href={`/startup/${publicUsername}`} target="_blank" rel="noreferrer" style={{ color: "hsl(22 55% 54%)", textDecoration: "underline" }}>/startup/{publicUsername}</a>
                      </p>
                    )}
                  </>
                )}

                <button type="submit" disabled={savingPublicProfile} className="cs-btn cs-btn-sm" style={{ alignSelf: "flex-start" }}>
                  {savingPublicProfile ? "Saving…" : "Save"}
                </button>
              </form>
            </SectionCard>
          )}

          {/* ══ NOTIFICATIONS (continued) ════════════════════════════════════════ */}
          {activeTab === "notifications" && <>

          {/* Telegram Notifications */}
          <SectionCard title="Telegram Notifications" subtitle="Get instant push notifications directly in Telegram — no inbox required.">
            {tgStatus && !tgStatus.configured ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.15)" }}>
                  <span className="text-sm font-medium" style={{ color: "#D4B896" }}>Bot not yet activated</span>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>
                    Set up in 2 minutes — completely free:
                  </p>
                  <ol className="flex flex-col gap-1.5 text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    <li>1. Open Telegram → search <strong style={{ color: "#D4B896" }}>@BotFather</strong> → send <code style={{ color: "hsl(22 55% 54%)" }}>/newbot</code></li>
                    <li>2. Choose a name (e.g. <em>Cascrow</em>) and a username ending in <em>bot</em></li>
                    <li>3. Copy the token BotFather gives you</li>
                    <li>4. Add these 3 env vars in your Vercel project settings:</li>
                  </ol>
                  <div className="flex flex-col gap-1 p-3 rounded-lg font-mono text-xs select-all" style={{ background: "rgba(0,0,0,0.3)", color: "hsl(32 35% 92%)" }}>
                    <span>TELEGRAM_BOT_TOKEN=<span style={{ color: "hsl(22 55% 54%)" }}>your-token-here</span></span>
                    <span>TELEGRAM_BOT_USERNAME=<span style={{ color: "hsl(22 55% 54%)" }}>YourBotUsername</span></span>
                    <span>TELEGRAM_WEBHOOK_SECRET=<span style={{ color: "hsl(22 55% 54%)" }}>any-random-string</span></span>
                  </div>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    After adding the env vars and redeploying, come back here to activate the webhook with one click.
                  </p>
                </div>
              </div>
            ) : tgStatus?.connected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#22c55e" }} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Connected</span>
                    {tgStatus.connectedAt && (
                      <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                        Since {new Date(tgStatus.connectedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={tgLoading}
                  onClick={handleTelegramDisconnect}
                  className="text-xs self-start transition-colors disabled:opacity-50"
                  style={{ color: "hsl(30 10% 62%)" }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "hsl(30 10% 62%)")}
                >
                  {tgLoading ? "…" : "Disconnect Telegram"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                  Click below to generate a one-time link. Open it in Telegram to connect your account.
                </p>
                {tgDeepLink ? (
                  <div className="flex flex-col gap-3">
                    <a
                      href={tgDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-colors"
                      style={{ background: "#229ED9", color: "#fff", display: "block" }}
                    >
                      Open in Telegram →
                    </a>
                    <p className="text-xs text-center" style={{ color: "hsl(30 10% 62%)" }}>Link expires in 15 minutes. Reload this page after connecting to see your status.</p>
                    <button
                      type="button"
                      onClick={handleTelegramConnect}
                      className="text-xs self-center"
                      style={{ color: "hsl(30 10% 62%)" }}
                    >
                      Generate new link
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={tgLoading}
                    onClick={handleTelegramConnect}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ background: "#229ED9", color: "#fff" }}
                  >
                    {tgLoading ? "Generating link…" : "Connect Telegram"}
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          {/* Slack / Teams */}
          <SectionCard title="Slack & Teams" subtitle="Get instant notifications where your team works.">
            <div className="flex flex-col gap-4">
              {/* Slack */}
              <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "hsl(24 12% 6% / 0.6)", border: "1px solid hsl(28 18% 14% / 0.8)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "hsl(32 35% 92%)" }}>Slack</span>
                    {slackIntegration && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}>Connected — #{slackIntegration.channelName ?? "channel"}</span>}
                  </div>
                  <div className="flex gap-2">
                    {slackIntegration ? (
                      <>
                        <button
                          type="button"
                          disabled={integrationTesting === "slack"}
                          onClick={async () => {
                            setIntegrationTesting("slack");
                            try {
                              const r = await fetch("/api/enterprise/integrations/slack/test", { method: "POST" });
                              if (r.ok) toast.success("Test message sent to Slack!");
                              else toast.error("Test failed — check your connection");
                            } finally { setIntegrationTesting(null); }
                          }}
                          className="cs-btn-ghost cs-btn-sm text-xs"
                        >
                          {integrationTesting === "slack" ? "Sending…" : "Test"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/enterprise/integrations/slack", { method: "DELETE" });
                            setSlackIntegration(null);
                            toast.success("Slack disconnected");
                          }}
                          className="cs-btn-ghost cs-btn-sm text-xs"
                          style={{ color: "#ef4444" }}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <a
                        href="/api/enterprise/integrations/slack/connect"
                        className="cs-btn cs-btn-sm text-xs"
                        style={{ background: "#4A154B", color: "#fff", padding: "6px 14px", borderRadius: "6px", textDecoration: "none", fontWeight: 600 }}
                      >
                        Connect Slack
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Receive attestation results, deadline alerts, and connector errors directly in a Slack channel.</p>
              </div>

              {/* Microsoft Teams */}
              <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "hsl(24 12% 6% / 0.6)", border: "1px solid hsl(28 18% 14% / 0.8)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "hsl(32 35% 92%)" }}>Microsoft Teams</span>
                    {teamsIntegration && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}>Connected</span>}
                  </div>
                  {teamsIntegration && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={integrationTesting === "teams"}
                        onClick={async () => {
                          setIntegrationTesting("teams");
                          try {
                            const r = await fetch("/api/enterprise/integrations/teams/test", { method: "POST" });
                            if (r.ok) toast.success("Test message sent to Teams!");
                            else toast.error("Test failed — check your webhook URL");
                          } finally { setIntegrationTesting(null); }
                        }}
                        className="cs-btn-ghost cs-btn-sm text-xs"
                      >
                        {integrationTesting === "teams" ? "Sending…" : "Test"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/enterprise/integrations/teams", { method: "DELETE" });
                          setTeamsIntegration(null);
                          setTeamsWebhookUrl("");
                          toast.success("Teams disconnected");
                        }}
                        className="cs-btn-ghost cs-btn-sm text-xs"
                        style={{ color: "#ef4444" }}
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
                {!teamsIntegration && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!teamsWebhookUrl.startsWith("https://")) return;
                      setTeamsSaving(true);
                      try {
                        const r = await fetch("/api/enterprise/integrations/teams", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ webhookUrl: teamsWebhookUrl }),
                        });
                        if (!r.ok) throw new Error();
                        const d = await r.json() as { integration: typeof teamsIntegration };
                        setTeamsIntegration(d.integration);
                        toast.success("Teams webhook saved");
                      } catch {
                        toast.error("Could not save Teams webhook");
                      } finally { setTeamsSaving(false); }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="url"
                      value={teamsWebhookUrl}
                      onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                      placeholder="https://your-org.webhook.office.com/..."
                      className="cs-input flex-1 text-xs"
                      required
                    />
                    <button type="submit" disabled={teamsSaving || !teamsWebhookUrl} className="cs-btn cs-btn-sm text-xs">
                      {teamsSaving ? "Saving…" : "Save"}
                    </button>
                  </form>
                )}
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Paste an Incoming Webhook URL from your Teams channel settings.</p>
              </div>
            </div>
          </SectionCard>

          </>}

          {/* ══ INTEGRATIONS (continued) ═════════════════════════════════════════ */}
          {activeTab === "integrations" && <>

          {/* API Keys */}
          <SectionCard title="API Keys" subtitle="Generate keys for AI agents and external tools to call the Cascrow API on your behalf. Keys start with csk_.">
            {newKeySecret && (
              <div className="flex flex-col gap-2 p-4 rounded-xl mb-3" style={{ background: "hsl(22 55% 54% / 0.08)", border: "1px solid hsl(22 55% 54% / 0.3)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(22 55% 54%)" }}>Save this key — shown only once</span>
                <code className="text-xs font-mono break-all select-all p-2 rounded" style={{ background: "rgba(0,0,0,0.3)", color: "hsl(32 35% 92%)" }}>{newKeySecret}</code>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Use as: <code style={{ color: "#D4B896" }}>Authorization: Bearer {newKeySecret}</code></p>
                <button type="button" onClick={() => setNewKeySecret(null)} className="text-xs self-end" style={{ color: "hsl(30 10% 62%)" }}>Dismiss</button>
              </div>
            )}

            {apiKeys.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.12)" }}>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>{k.name}</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono" style={{ color: "hsl(22 55% 54%)" }}>{k.keyPrefix}…</code>
                        <span className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>
                          {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteApiKey(k.id)}
                      className="text-xs shrink-0"
                      style={{ color: "hsl(30 10% 62%)" }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "hsl(30 10% 62%)")}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showNewKeyForm ? (
              <form onSubmit={handleCreateApiKey} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Key name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Claude Agent, My CI Bot"
                    className="cs-input"
                    maxLength={80}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={creatingKey} className="cs-btn-primary text-sm px-4 py-2">
                    {creatingKey ? "Generating…" : "Generate Key"}
                  </button>
                  <button type="button" onClick={() => { setShowNewKeyForm(false); setNewKeyName(""); }} className="cs-btn text-sm px-4 py-2">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewKeyForm(true)}
                disabled={apiKeys.length >= 10}
                className="cs-btn text-sm"
              >
                + Generate API Key
              </button>
            )}

            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: "hsl(22 55% 54% / 0.05)", color: "hsl(30 10% 62%)" }}>
              <span style={{ color: "hsl(22 55% 54%)", fontWeight: 600 }}>MCP Integration:</span>{" "}
              Add Cascrow as a tool in Claude Code or any MCP-compatible agent:{" "}
              <code style={{ color: "#D4B896" }}>cascrow_verify_milestone</code> at{" "}
              <code style={{ color: "#D4B896" }}>https://cascrow.com/api/mcp/submit</code>
            </div>
          </SectionCard>

          {/* Webhooks */}
          <SectionCard title="Webhooks" subtitle="Send signed POST requests to your systems on every contract event.">
            {whSecret && (
              <div className="flex flex-col gap-2 p-4 rounded-xl mb-2" style={{ background: "hsl(22 55% 54% / 0.08)", border: "1px solid hsl(22 55% 54% / 0.3)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(22 55% 54%)" }}>Save this secret — shown only once</span>
                <code className="text-xs font-mono break-all select-all p-2 rounded" style={{ background: "rgba(0,0,0,0.3)", color: "hsl(32 35% 92%)" }}>{whSecret}</code>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Verify incoming requests: <code style={{ color: "#D4B896" }}>HMAC-SHA256(secret, rawBody) === X-Cascrow-Signature</code></p>
                <button type="button" onClick={() => setWhSecret(null)} className="text-xs self-end" style={{ color: "hsl(30 10% 62%)" }}>Dismiss</button>
              </div>
            )}

            {webhooks.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="flex flex-col rounded-xl overflow-hidden" style={{ border: "1px solid hsl(22 55% 54% / 0.12)" }}>
                    <div className="flex items-start gap-3 p-3 text-sm" style={{ background: "hsl(24 12% 6% / 0.5)" }}>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <code className="text-xs font-mono truncate" style={{ color: "hsl(32 35% 92%)" }}>{wh.url}</code>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {wh.events.map((ev) => (
                            <span key={ev} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "hsl(22 55% 54% / 0.1)", color: "hsl(22 55% 54%)" }}>{ev}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewDeliveries(wh.id)}
                          className="text-xs"
                          style={{ color: "hsl(30 10% 62%)" }}
                        >
                          {expandedDeliveries === wh.id ? "Hide" : "History"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleWebhook(wh.id, !wh.active)}
                          className="text-xs"
                          style={{ color: wh.active ? "#22c55e" : "hsl(30 10% 62%)" }}
                        >
                          {wh.active ? "Active" : "Paused"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="text-xs"
                          style={{ color: "hsl(30 10% 62%)" }}
                          onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseOut={(e) => (e.currentTarget.style.color = "hsl(30 10% 62%)")}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {expandedDeliveries === wh.id && (
                      <div className="flex flex-col gap-0 border-t" style={{ borderColor: "hsl(22 55% 54% / 0.12)", background: "rgba(0,0,0,0.15)" }}>
                        {loadingDeliveries === wh.id ? (
                          <p className="text-xs p-3" style={{ color: "hsl(30 10% 62%)" }}>Loading…</p>
                        ) : (deliveryHistory[wh.id] ?? []).length === 0 ? (
                          <p className="text-xs p-3" style={{ color: "hsl(30 10% 62%)" }}>No deliveries yet.</p>
                        ) : (
                          (deliveryHistory[wh.id] ?? []).map((d) => (
                            <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs border-b last:border-b-0" style={{ borderColor: "hsl(22 55% 54% / 0.08)" }}>
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: d.success ? "#22c55e" : "#ef4444" }}
                              />
                              <span className="font-mono" style={{ color: "hsl(22 55% 54%)", minWidth: 28 }}>{d.statusCode ?? "—"}</span>
                              <span style={{ color: "#D4B896", flex: 1 }}>{d.event}</span>
                              <span style={{ color: "hsl(30 10% 62%)" }}>{d.responseMs}ms</span>
                              <span style={{ color: "hsl(28 14% 36%)" }}>{new Date(d.createdAt).toLocaleString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showNewWebhook ? (
              <form onSubmit={handleAddWebhook} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">HTTPS Endpoint URL</label>
                  <input
                    type="url"
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    className="cs-input"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cs-label">Events to subscribe</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_WEBHOOK_EVENTS.map((ev) => {
                      const checked = whEvents.includes(ev);
                      return (
                        <button
                          key={ev}
                          type="button"
                          onClick={() => setWhEvents((prev) => checked ? prev.filter((e) => e !== ev) : [...prev, ev])}
                          className="text-xs px-2.5 py-1 rounded-full transition-colors"
                          style={{
                            background: checked ? "hsl(22 55% 54% / 0.2)" : "hsl(24 12% 6% / 0.7)",
                            border: `1px solid ${checked ? "hsl(22 55% 54%)" : "hsl(22 55% 54% / 0.2)"}`,
                            color: checked ? "hsl(22 55% 54%)" : "hsl(30 10% 62%)",
                          }}
                        >
                          {ev}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={whSaving} className="cs-btn-ghost cs-btn-sm">
                    {whSaving ? "Adding…" : "Add Webhook"}
                  </button>
                  <button type="button" onClick={() => setShowNewWebhook(false)} className="cs-btn-ghost cs-btn-sm" style={{ opacity: 0.6 }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewWebhook(true)}
                className="cs-btn-ghost cs-btn-sm self-start"
              >
                + Add Endpoint
              </button>
            )}
          </SectionCard>

          </>}

          {/* ══ SECURITY (continued) ═════════════════════════════════════════════ */}
          {activeTab === "security" && <>

          {/* Security — Sessions */}
          <SectionCard title="Security" subtitle="Recent sign-ins and active session management">
            <div className="flex flex-col gap-4">
              {sessions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(30 10% 62%)" }}>Recent sign-ins</p>
                  {sessions.map((s) => {
                    const ua = s.userAgent ?? "";
                    const browser = ua.includes("Chrome") ? "Chrome"
                      : ua.includes("Firefox") ? "Firefox"
                      : ua.includes("Safari") ? "Safari"
                      : ua.includes("Edge") ? "Edge"
                      : ua ? "Browser" : "Unknown";
                    const os = ua.includes("Windows") ? "Windows"
                      : ua.includes("Mac") ? "macOS"
                      : ua.includes("Linux") ? "Linux"
                      : ua.includes("Android") ? "Android"
                      : ua.includes("iPhone") || ua.includes("iPad") ? "iOS"
                      : "";
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm" style={{ borderBottom: "1px solid hsl(22 55% 54% / 0.07)" }}>
                        <div className="flex flex-col gap-0.5">
                          <span style={{ color: "hsl(32 35% 92%)" }}>{[browser, os].filter(Boolean).join(" · ") || "Unknown device"}</span>
                          <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>{s.ip ?? "IP unknown"}</span>
                        </div>
                        <span className="text-xs shrink-0" style={{ color: "hsl(28 14% 36%)" }}>
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl" style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.1)" }}>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Sign out of all sessions</span>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Revokes all active sessions across every device. You will need to sign in again.</p>
                </div>
                <button type="button" onClick={handleRevokeAllSessions} disabled={revokeAllLoading} className="cs-btn-ghost cs-btn-sm shrink-0" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                  {revokeAllLoading ? "Signing out…" : "Sign out everywhere"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Account Info */}
          <SectionCard title="Account">
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center justify-between py-3 text-sm"
                style={{ borderBottom: "1px solid hsl(22 55% 54% / 0.1)" }}
              >
                <span style={{ color: "hsl(30 10% 62%)" }}>Member since</span>
                <span style={{ color: "hsl(32 35% 92%)" }}>
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 text-sm">
                <span style={{ color: "hsl(30 10% 62%)" }}>Role</span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest"
                  style={{
                    background: "hsl(22 55% 54% / 0.1)",
                    border: "1px solid hsl(22 55% 54% / 0.25)",
                    color: "hsl(22 55% 54%)",
                  }}
                >
                  {role === "INVESTOR" ? "Grant Giver" : "Receiver"}
                </span>
              </div>
            </div>
          </SectionCard>

          </>}

          {/* ══ PRIVACY ══════════════════════════════════════════════════════════ */}
          {activeTab === "privacy" && <>

          {/* Privacy & Data (GDPR) */}
          <SectionCard title="Privacy & Data" subtitle="Your rights under GDPR / data protection law">
            <div className="flex flex-col gap-4">
              {/* Export */}
              <div
                className="flex items-start justify-between gap-4 p-4 rounded-xl"
                style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.1)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Export My Data</span>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Download a JSON file with all data we hold about you: profile, contracts, proofs, and audit logs.</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="cs-btn-ghost cs-btn-sm shrink-0"
                >
                  {exportingData ? "Exporting…" : "Export"}
                </button>
              </div>

              {/* Delete */}
              <div
                className="flex flex-col gap-3 p-4 rounded-xl"
                style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Delete Account</span>
                  <p className="text-xs mt-1" style={{ color: "hsl(30 10% 62%)" }}>
                    Permanently anonymizes your personal data. Contracts with active escrow are preserved for the other party&apos;s records. This cannot be undone.
                  </p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="cs-btn-ghost cs-btn-sm self-start text-xs"
                    style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                      Type your email address to confirm:
                    </p>
                    <input
                      type="email"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      placeholder={profile.email}
                      className="cs-input text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount || !deleteConfirmEmail}
                        className="cs-btn-sm rounded-xl px-4 py-1.5 text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", opacity: deletingAccount || !deleteConfirmEmail ? 0.5 : 1 }}
                      >
                        {deletingAccount ? "Deleting…" : "Confirm Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmEmail(""); }}
                        className="cs-btn-ghost cs-btn-sm"
                        style={{ opacity: 0.6 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Support & Help */}
          <SectionCard title="Support & Help" subtitle="Chat with our support bot or view your open tickets">
            <div className="flex flex-col gap-4">
              {/* Open chat button */}
              <div
                className="flex items-center justify-between gap-4 p-4 rounded-xl"
                style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.1)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Live Support Chat</span>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    Ask the AI support bot a question or get escalated to our team — replies appear directly in chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("open-support-chat"))}
                  className="cs-btn cs-btn-sm shrink-0"
                  style={{ background: "hsl(22 55% 54%)", color: "#fff", padding: "6px 16px", borderRadius: "8px", fontWeight: 600, fontSize: 12, border: "none", cursor: "pointer" }}
                >
                  Open chat
                </button>
              </div>

              {/* System status link */}
              <div
                className="flex items-center justify-between gap-4 p-4 rounded-xl"
                style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.1)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>System Status</span>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                    Check live status of the database, XRPL, EVM RPC, and AI verification services.
                  </p>
                </div>
                <a
                  href="/status"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cs-btn-ghost cs-btn-sm shrink-0"
                >
                  View status
                </a>
              </div>

              {/* My tickets */}
              {myTickets.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="text-xs font-semibold" style={{ color: "hsl(30 10% 62%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    My Tickets
                  </div>
                  {myTickets.map((ticket) => {
                    const adminReplies = ticket.messages.filter((m) => m.role === "admin");
                    const lastAdminReply = adminReplies[adminReplies.length - 1];
                    const statusColor: Record<string, string> = {
                      OPEN: "#ef4444", IN_PROGRESS: "#f59e0b", RESOLVED: "#22c55e", CLOSED: "#6b7280",
                    };
                    return (
                      <div
                        key={ticket.id}
                        className="flex flex-col gap-2 p-4 rounded-xl"
                        style={{ background: "hsl(24 12% 6% / 0.3)", border: "1px solid hsl(22 55% 54% / 0.1)" }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm" style={{ color: "hsl(32 35% 92%)", fontWeight: 500 }}>{ticket.subject}</span>
                          <span className="text-xs font-bold shrink-0" style={{ color: statusColor[ticket.status] ?? "hsl(30 10% 62%)" }}>
                            {ticket.status.replace("_", " ")}
                          </span>
                        </div>
                        {lastAdminReply ? (
                          <div
                            className="rounded-lg p-3 text-xs"
                            style={{ background: "hsl(22 55% 54% / 0.08)", border: "1px solid hsl(22 55% 54% / 0.15)", color: "hsl(32 35% 92%)", lineHeight: 1.5 }}
                          >
                            <span style={{ color: "hsl(22 55% 54%)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                              cascrow team replied
                            </span>
                            {lastAdminReply.content}
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Waiting for team response…</p>
                        )}
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new Event("open-support-chat"))}
                          className="text-xs self-start"
                          style={{ color: "hsl(22 55% 54%)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                        >
                          Continue in chat
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>

          </>}

          {/* ══ USAGE ══════════════════════════════════════════════════════════ */}
          {activeTab === "usage" && <>
          <SectionCard title="Your Activity" subtitle="A summary of your activity on cascrow">
            {loadingUsage ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="rounded-xl p-4" style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.08)", height: 72 }} />
                ))}
              </div>
            ) : usageStats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Contracts created", value: usageStats.contractsAsInvestor, show: role === "INVESTOR" },
                    { label: "Contracts received", value: usageStats.contractsAsStartup, show: role === "STARTUP" },
                    { label: "Total milestones", value: usageStats.totalMilestones, show: true },
                    { label: "Milestones verified", value: usageStats.milestonesVerified + usageStats.milestonesCompleted, show: true },
                    { label: "Milestones rejected", value: usageStats.milestonesRejected, show: true },
                    { label: "Proofs submitted", value: usageStats.proofCount, show: true },
                  ].filter(s => s.show).map(s => (
                    <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.08)" }}>
                      <span className="text-2xl font-bold" style={{ color: "hsl(32 35% 92%)", letterSpacing: "-0.03em" }}>{s.value}</span>
                      <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
                {usageStats.memberSince && (
                  <p className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>
                    Member since {new Date(usageStats.memberSince).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Could not load usage stats.</p>
            )}
          </SectionCard>
          </>}

        </div>
      </main>
    </div>
  );
}
