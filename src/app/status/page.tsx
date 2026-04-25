"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ServiceStatus {
  label: string;
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

interface HealthResponse {
  status: "operational" | "degraded";
  services: Record<string, ServiceStatus>;
  checkedAt: string;
  network: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: ok ? "#22c55e" : "#ef4444",
        boxShadow: ok ? "0 0 6px rgba(34,197,94,0.6)" : "0 0 6px rgba(239,68,68,0.6)",
        flexShrink: 0,
      }}
    />
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 20px",
        borderBottom: "1px solid rgba(196,112,75,0.08)",
      }}
    >
      <StatusDot ok={service.ok} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: "#EDE6DD" }}>{service.label}</div>
        {service.detail && (
          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>{service.detail}</div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: service.ok ? "#22c55e" : "#ef4444",
          }}
        >
          {service.ok ? "Operational" : "Degraded"}
        </div>
        {service.latencyMs !== undefined && (
          <div style={{ fontSize: 11, color: "#A89B8C", marginTop: 1 }}>{service.latencyMs} ms</div>
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  const allOk = health?.status === "operational";
  const services = health ? Object.values(health.services) : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#171311",
        color: "#EDE6DD",
        fontFamily: "var(--font-libre-franklin), var(--font-geist-sans), sans-serif",
        padding: "60px 24px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ fontSize: 13, color: "#A89B8C", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            cascrow.com
          </Link>

          <h1
            style={{
              fontSize: 32,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            System Status
          </h1>

          {loading ? (
            <p style={{ fontSize: 14, color: "#A89B8C" }}>Checking services…</p>
          ) : health === null ? (
            <p style={{ fontSize: 14, color: "#ef4444" }}>Could not reach the health endpoint.</p>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 50,
                background: allOk ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${allOk ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                fontSize: 14,
                fontWeight: 600,
                color: allOk ? "#22c55e" : "#ef4444",
              }}
            >
              <StatusDot ok={allOk} />
              {allOk ? "All systems operational" : "Some systems degraded"}
            </div>
          )}
        </div>

        {/* Services */}
        {!loading && health && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.15)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid rgba(196,112,75,0.12)",
                fontSize: 11,
                color: "#A89B8C",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Services
            </div>
            {services.map((svc) => (
              <ServiceRow key={svc.label} service={svc} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: 12, color: "#A89B8C", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : ""}
          </span>
          <button
            onClick={fetchHealth}
            style={{
              background: "none",
              border: "1px solid rgba(196,112,75,0.2)",
              borderRadius: 6,
              padding: "5px 12px",
              color: "#A89B8C",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Refresh
          </button>
        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: "rgba(168,155,140,0.5)", textAlign: "center" }}>
          Updates every 60 seconds · Network: {health?.network ?? "—"}
        </p>
      </div>
    </div>
  );
}
