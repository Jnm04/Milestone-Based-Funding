"use client";

import { useState } from "react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href?: string;
  action?: string;
}

interface Props {
  hasGoalSet: boolean;
  hasTeamMember: boolean;
  hasAttestationRun: boolean;
  hasAuditor: boolean;
}

const STORAGE_KEY = "ent_onboarding_dismissed";

export function EnterpriseOnboardingChecklist({ hasGoalSet, hasTeamMember, hasAttestationRun, hasAuditor }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  const items: ChecklistItem[] = [
    {
      id: "goal_set",
      label: "Create your first goal set",
      description: "Define goals and milestones for AI-verified attestation",
      done: hasGoalSet,
      href: "/enterprise/dashboard/attestations/new",
      action: "Create goal set",
    },
    {
      id: "team",
      label: "Invite a team member",
      description: "Add colleagues who can view or approve attestations",
      done: hasTeamMember,
      href: "/enterprise/dashboard/settings",
      action: "Manage team",
    },
    {
      id: "attestation",
      label: "Run your first attestation",
      description: "Let the 5-model AI panel verify a milestone",
      done: hasAttestationRun,
      href: "/enterprise/dashboard/attestations",
      action: "Go to attestations",
    },
    {
      id: "auditor",
      label: "Assign an external auditor",
      description: "Grant a third-party read-only access to your attestation data",
      done: hasAuditor,
      href: "/enterprise/dashboard/auditors",
      action: "Add auditor",
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;

  if (dismissed || allDone) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div style={{
      background: "white",
      border: "1px solid var(--ent-border)",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
            Getting started
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>
            {completedCount} of {items.length} steps completed
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ent-muted)", padding: 4, display: "flex", alignItems: "center" }}
          title="Dismiss"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--ent-border)", borderRadius: 99, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(completedCount / items.length) * 100}%`,
          background: "var(--ent-accent)",
          borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 8,
              background: item.done ? "#F0FDF4" : "var(--ent-bg)",
              border: `1px solid ${item.done ? "#BBF7D0" : "var(--ent-border)"}`,
              opacity: item.done ? 0.7 : 1,
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              flexShrink: 0,
              marginTop: 1,
              background: item.done ? "#22C55E" : "white",
              border: `2px solid ${item.done ? "#22C55E" : "var(--ent-border)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {item.done && (
                <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "var(--ent-text)", textDecoration: item.done ? "line-through" : "none" }}>
                {item.label}
              </p>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--ent-muted)", lineHeight: 1.4 }}>
                {item.description}
              </p>
              {!item.done && item.href && (
                <a
                  href={item.href}
                  style={{ fontSize: 12, color: "var(--ent-accent)", fontWeight: 600, textDecoration: "none" }}
                >
                  {item.action} →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
