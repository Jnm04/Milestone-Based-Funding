"use client";

import { useState } from "react";
import { Bot, Copy, Check, ArrowRight, X, Key, Terminal, Zap } from "lucide-react";

interface DeployAgentModalProps {
  onClose: () => void;
}

const STEPS = ["name", "key", "setup"] as const;
type Step = typeof STEPS[number];

export function DeployAgentModal({ onClose }: DeployAgentModalProps) {
  const [step, setStep] = useState<Step>("name");
  const [agentName, setAgentName] = useState("");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const createKey = async () => {
    if (!agentName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/enterprise/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create key");
      setSecret(data.secret);
      setStep("key");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [id]: false })), 2000);
  };

  const mcpConfig = secret ? JSON.stringify({
    mcpServers: {
      cascrow: {
        command: "node",
        args: ["/path/to/cascrow-mcp/index.js"],
        env: { CASCROW_API_KEY: secret },
      },
    },
  }, null, 2) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div
        className="relative w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: "hsl(24 12% 7%)", border: "1px solid hsl(22 55% 54% / 0.2)", boxShadow: "0 40px 80px -20px hsl(22 55% 20% / 0.5)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid hsl(28 18% 12%)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "hsl(22 55% 54% / 0.12)", border: "1px solid hsl(22 55% 54% / 0.2)" }}>
              <Bot className="h-4 w-4" style={{ color: "hsl(22 55% 54%)" }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "hsl(32 35% 92%)" }}>Deploy an Agent</div>
              <div className="text-xs" style={{ color: "hsl(30 10% 50%)" }}>Humans own · Agents act</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "hsl(30 10% 50%)", cursor: "pointer" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 py-4">
          {([["name", "1", "Name your agent"], ["key", "2", "Get API key"], ["setup", "3", "Connect"]] as const).map(([s, n, label]) => {
            const idx = STEPS.indexOf(s);
            const cur = STEPS.indexOf(step);
            const done = idx < cur;
            const active = idx === cur;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: done ? "hsl(22 55% 54%)" : active ? "hsl(22 55% 54% / 0.15)" : "hsl(28 18% 12%)",
                      color: done ? "hsl(24 14% 6%)" : active ? "hsl(22 55% 54%)" : "hsl(30 10% 40%)",
                      border: active ? "1px solid hsl(22 55% 54% / 0.4)" : "none",
                    }}
                  >
                    {done ? <Check className="h-3 w-3" /> : n}
                  </div>
                  <span className="text-xs" style={{ color: active ? "hsl(32 35% 92%)" : "hsl(30 10% 40%)", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="mx-1 h-px w-4" style={{ background: "hsl(28 18% 16%)" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex flex-col gap-4">

          {/* Step 1: Name */}
          {step === "name" && (
            <>
              <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                Give your agent a name. It will act on your behalf using a scoped API key — you stay in control, it executes.
              </p>
              <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "hsl(24 14% 4% / 0.6)", border: "1px solid hsl(28 18% 12%)" }}>
                {[
                  { icon: Key, text: "Scoped to your account — agent inherits your permissions" },
                  { icon: Zap, text: "Works with Claude Desktop (MCP), Python, or any HTTP client" },
                  { icon: Bot, text: "One key per agent — revoke anytime from Settings" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs" style={{ color: "hsl(30 10% 55%)" }}>
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(22 55% 54%)" }} />
                    {text}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-widest" style={{ color: "hsl(30 10% 50%)", fontFamily: "'JetBrains Mono', monospace" }}>Agent name</label>
                <input
                  autoFocus
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agentName.trim() && createKey()}
                  placeholder="e.g. Claude Agent, CI Bot, My Automation"
                  maxLength={80}
                  className="cs-input"
                />
              </div>
              <button
                onClick={createKey}
                disabled={!agentName.trim() || creating}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-opacity"
                style={{ background: "hsl(22 55% 54%)", color: "hsl(24 14% 6%)", opacity: !agentName.trim() || creating ? 0.5 : 1, cursor: !agentName.trim() || creating ? "not-allowed" : "pointer" }}
              >
                {creating ? "Generating…" : <><Key className="h-4 w-4" /> Generate API Key</>}
              </button>
            </>
          )}

          {/* Step 2: Show key */}
          {step === "key" && secret && (
            <>
              <div className="flex flex-col gap-1 rounded-xl p-4" style={{ background: "hsl(22 55% 54% / 0.06)", border: "1px solid hsl(22 55% 54% / 0.25)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(22 55% 54%)", fontFamily: "'JetBrains Mono', monospace" }}>Your API Key — save it now</span>
                  <button
                    onClick={() => copy(secret, "key")}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors"
                    style={{ background: copied["key"] ? "hsl(22 55% 54% / 0.15)" : "transparent", color: "hsl(22 55% 54%)", cursor: "pointer" }}
                  >
                    {copied["key"] ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>
                <code className="text-xs break-all select-all" style={{ fontFamily: "'JetBrains Mono', monospace", color: "hsl(32 35% 92%)" }}>{secret}</code>
              </div>
              <p className="text-xs" style={{ color: "hsl(30 10% 50%)" }}>
                This key is shown <strong style={{ color: "hsl(32 35% 80%)" }}>once</strong>. Store it in your agent&apos;s environment variables. You can revoke it anytime in Settings → Integrations.
              </p>
              <button
                onClick={() => setStep("setup")}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
                style={{ background: "hsl(22 55% 54%)", color: "hsl(24 14% 6%)", cursor: "pointer" }}
              >
                Continue to setup <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Step 3: Setup instructions */}
          {step === "setup" && secret && (
            <>
              <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                Your agent is ready. Choose how to connect:
              </p>

              {/* MCP Tab */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(28 18% 14%)" }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "hsl(24 14% 4% / 0.6)", borderBottom: "1px solid hsl(28 18% 14%)" }}>
                  <Bot className="h-3.5 w-3.5" style={{ color: "hsl(22 55% 54%)" }} />
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "hsl(30 10% 62%)" }}>Claude Desktop — MCP</span>
                  <button
                    onClick={() => copy(mcpConfig, "mcp")}
                    className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                    style={{ background: "hsl(22 55% 54% / 0.1)", color: "hsl(22 55% 54%)", cursor: "pointer" }}
                  >
                    {copied["mcp"] ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>
                <pre className="p-4 text-xs overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace", color: "hsl(32 35% 85%)", lineHeight: 1.6 }}>{mcpConfig}</pre>
              </div>

              {/* REST */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(28 18% 14%)" }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "hsl(24 14% 4% / 0.6)", borderBottom: "1px solid hsl(28 18% 14%)" }}>
                  <Terminal className="h-3.5 w-3.5" style={{ color: "hsl(22 55% 54%)" }} />
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: "hsl(30 10% 62%)" }}>REST API — any language</span>
                  <button
                    onClick={() => copy(`Authorization: Bearer ${secret}`, "rest")}
                    className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                    style={{ background: "hsl(22 55% 54% / 0.1)", color: "hsl(22 55% 54%)", cursor: "pointer" }}
                  >
                    {copied["rest"] ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>
                <pre className="p-4 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "hsl(32 35% 85%)", lineHeight: 1.6 }}>{`Authorization: Bearer ${secret}`}</pre>
              </div>

              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
                style={{ background: "hsl(22 55% 54%)", color: "hsl(24 14% 6%)", cursor: "pointer" }}
              >
                Done — agent is deployed <Check className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
