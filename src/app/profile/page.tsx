"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
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
      });
  }, [status, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, department, jobTitle, phone, bio, website }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Profil gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwörter stimmen nicht überein."); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Passwort geändert.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Ändern");
    } finally {
      setSavingPw(false);
    }
  }

  const dashboardHref = profile?.role === "INVESTOR" ? "/dashboard/investor" : "/dashboard/startup";

  if (status === "loading" || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Laden…</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">MilestoneFund</Link>
        <div className="flex items-center gap-3">
          <Link href={dashboardHref} className="text-sm text-muted-foreground hover:text-zinc-900">← Dashboard</Link>
          <Badge variant="outline">{profile.role === "INVESTOR" ? "Investor" : "Startup"}</Badge>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Abmelden
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Mein Profil</h1>
          <p className="text-muted-foreground mt-1">Persönliche Angaben und Sicherheit verwalten</p>
        </div>

        {/* Profile Info */}
        <section className="bg-white rounded-2xl border p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-base">Profilinformationen</h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">E-Mail</label>
            <p className="text-sm text-zinc-900 bg-zinc-50 border rounded-lg px-3 py-2">{profile.email}</p>
          </div>

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Firmenname</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme GmbH"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Position / Titel</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="CEO, CFO, Founder…"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Abteilung</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Finance, Engineering…"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Telefon</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+49 123 456789"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://beispiel.de"
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Über mich / Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Kurze Beschreibung…"
                rows={3}
                className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">EVM Wallet (MetaMask)</label>
              <p className="text-sm text-zinc-900 bg-zinc-50 border rounded-lg px-3 py-2 font-mono break-all">
                {profile.walletAddress ?? <span className="text-zinc-400">Noch keine Wallet verbunden</span>}
              </p>
              <p className="text-xs text-zinc-400">0x… Adresse aus MetaMask eintragen lassen (über Dashboard)</p>
            </div>

            <Button type="submit" disabled={saving} className="self-end">
              {saving ? "Wird gespeichert…" : "Profil speichern"}
            </Button>
          </form>
        </section>

        {/* Password Change */}
        <section className="bg-white rounded-2xl border p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-base">Passwort ändern</h2>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Aktuelles Passwort</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Passwort bestätigen</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPw} variant="outline" className="self-end">
              {savingPw ? "Wird geändert…" : "Passwort ändern"}
            </Button>
          </form>
        </section>

        {/* Account Info */}
        <section className="bg-white rounded-2xl border p-6 flex flex-col gap-3">
          <h2 className="font-semibold text-base">Account</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Mitglied seit</span>
            <span className="text-zinc-900">{new Date(profile.createdAt).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Rolle</span>
            <Badge variant="outline">{profile.role === "INVESTOR" ? "Investor" : "Startup"}</Badge>
          </div>
        </section>
      </div>
    </main>
  );
}
