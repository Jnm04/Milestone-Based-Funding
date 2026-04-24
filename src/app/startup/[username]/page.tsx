import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface MilestoneData {
  id: string;
  title: string;
  amountUSD: string;
  nftTokenId: string | null;
  nftImageUrl: string | null;
  reputationSummary: string | null;
  reputationCategory: string | null;
}

interface ProfileData {
  username: string;
  name: string | null;
  companyName: string | null;
  bio: string | null;
  website: string | null;
  linkedinUrl: string | null;
  verifiedBadgeNftId: string | null;
  memberSince: string;
  stats: { milestonesCompleted: number; totalRlusdReceived: number };
  milestones: MilestoneData[];
}

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function getProfile(username: string): Promise<ProfileData | null> {
  const res = await fetch(`${BASE_URL}/api/startup/${username}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json() as { profile: ProfileData };
  return data.profile;
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Profile not found — cascrow" };
  return {
    title: `${profile.companyName ?? profile.name ?? username} — cascrow Verified Startup`,
    description: profile.bio ?? `${profile.companyName ?? username} has completed ${profile.stats.milestonesCompleted} milestones on cascrow.`,
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  MVP: "🚀",
  REVENUE: "💰",
  PARTNERSHIP: "🤝",
  GITHUB: "💻",
  BETA: "🔬",
  OTHER: "✅",
};

export default async function StartupProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const isXrplMainnet = process.env.XRPL_NETWORK !== "testnet";
  const xrplExplorer = isXrplMainnet ? "xrpscan.com" : "testnet.xrpscan.com";

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #171311 0%, #1f1715 100%)",
        color: "#EDE6DD",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ background: "rgba(196,112,75,0.2)", border: "2px solid rgba(196,112,75,0.4)", color: "#C4704B" }}
          >
            {(profile.companyName ?? profile.name ?? username).charAt(0).toUpperCase()}
          </div>

          <div>
            <h1 className="text-3xl font-bold" style={{ color: "#EDE6DD" }}>
              {profile.companyName ?? profile.name ?? username}
            </h1>
            {profile.companyName && profile.name && (
              <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>{profile.name}</p>
            )}
          </div>

          {/* Verified badge */}
          {profile.verifiedBadgeNftId && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: "rgba(196,112,75,0.15)", border: "1px solid rgba(196,112,75,0.4)", color: "#C4704B" }}
            >
              ✦ Cascrow Verified
            </div>
          )}

          {profile.bio && (
            <p className="text-base max-w-md" style={{ color: "#A89B8C" }}>{profile.bio}</p>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1 rounded-full transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "#A89B8C", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                🌐 Website
              </a>
            )}
            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1 rounded-full transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "#A89B8C", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                in LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-3xl font-bold" style={{ color: "#C4704B" }}>
              {profile.stats.milestonesCompleted}
            </div>
            <div className="text-xs mt-1" style={{ color: "#A89B8C" }}>
              Milestones Completed
            </div>
          </div>
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-3xl font-bold" style={{ color: "#C4704B" }}>
              ${profile.stats.totalRlusdReceived.toLocaleString()}
            </div>
            <div className="text-xs mt-1" style={{ color: "#A89B8C" }}>
              Total RLUSD Received
            </div>
          </div>
        </div>

        {/* Milestone cards */}
        {profile.milestones.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold" style={{ color: "#EDE6DD" }}>Completed Milestones</h2>
            {profile.milestones.map((m) => (
              <div
                key={m.id}
                className="rounded-xl p-5 flex gap-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {m.nftImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.nftImageUrl}
                    alt="NFT certificate"
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>{m.title}</span>
                    {m.reputationCategory && (
                      <span className="text-xs flex-shrink-0" style={{ color: "#A89B8C" }}>
                        {CATEGORY_EMOJI[m.reputationCategory] ?? "✅"} {m.reputationCategory}
                      </span>
                    )}
                  </div>
                  {m.reputationSummary && (
                    <p className="text-xs mt-1" style={{ color: "#A89B8C" }}>{m.reputationSummary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-medium" style={{ color: "#C4704B" }}>
                      ${Number(m.amountUSD).toLocaleString()} RLUSD
                    </span>
                    {m.nftTokenId && (
                      <a
                        href={`https://${xrplExplorer}/nft/${m.nftTokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs"
                        style={{ color: "#A89B8C", textDecoration: "underline" }}
                      >
                        NFT Certificate →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {profile.milestones.length === 0 && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-sm" style={{ color: "#A89B8C" }}>No completed milestones yet.</p>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="text-xs"
            style={{ color: "#A89B8C", textDecoration: "underline" }}
          >
            Powered by cascrow
          </Link>
        </div>
      </div>
    </main>
  );
}
