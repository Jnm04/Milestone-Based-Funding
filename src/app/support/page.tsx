"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  role: "user" | "assistant" | "admin" | "system";
  content: string;
  timestamp?: string;
}

interface Ticket {
  id: string;
  subject: string;
  messages: Message[];
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

const PROBLEM_KEYWORDS =
  /can't|cannot|not working|error|broken|stuck|issue|problem|fail|bug|crash|fund|escrow|payment|metamask|wallet|proof|rejected|expired|won't|doesn't|didn't|help/i;

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#22c55e",
  CLOSED: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

export default function SupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"chat" | "cases">("chat");

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cantHelp, setCantHelp] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [lastAdminMsgCount, setLastAdminMsgCount] = useState(0);

  // Cases
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/support");
    }
  }, [status, router]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm the cascrow support assistant. I can help with contracts, escrow funding, proof submission, AI verification, and more. What's your question?",
      },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets/mine");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
      }
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "cases") loadTickets();
  }, [tab, loadTickets]);

  const pollAdminReplies = useCallback(async () => {
    if (!ticketId || !session?.user?.id) return;
    try {
      const res = await fetch("/api/support/tickets/mine");
      if (!res.ok) return;
      const data = await res.json();
      const ticket = data.tickets.find((t: Ticket) => t.id === ticketId);
      if (!ticket) return;
      const adminMsgs = ticket.messages.filter((m: Message) => m.role === "admin");
      if (adminMsgs.length > lastAdminMsgCount) {
        const newReplies = adminMsgs.slice(lastAdminMsgCount);
        setLastAdminMsgCount(adminMsgs.length);
        setMessages((prev) => [...prev, ...newReplies]);
      }
    } catch {
      // silent
    }
  }, [ticketId, session?.user?.id, lastAdminMsgCount]);

  useEffect(() => {
    if (!ticketId) return;
    const interval = setInterval(pollAdminReplies, 30_000);
    return () => clearInterval(interval);
  }, [ticketId, pollAdminReplies]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setCantHelp(false);

    if (PROBLEM_KEYWORDS.test(text)) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "Checking live system status…" },
      ]);
    }

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.role !== "system");
        return [
          ...filtered,
          { role: "assistant", content: data.reply ?? "Sorry, something went wrong." },
        ];
      });
      if (data.cantHelp) setCantHelp(true);
    } catch {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.role !== "system");
        return [
          ...filtered,
          {
            role: "assistant",
            content: "I'm having trouble right now. Please try again shortly.",
          },
        ];
      });
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (loading || creatingTicket) return;
    setCreatingTicket(true);
    const subject =
      messages.find((m) => m.role === "user")?.content?.slice(0, 80) ??
      "Support request";
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, createTicket: true, subject }),
      });
      const data = await res.json();
      setTicketId(data.ticketId);
      setCantHelp(false);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to create case. Please email support@cascrow.com.",
        },
      ]);
    } finally {
      setCreatingTicket(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    const matchSearch =
      !searchQuery || t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const hasConversation = messages.length > 1;

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#171311",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#A89B8C", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#171311",
        color: "#EDE6DD",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top nav bar ── */}
      <div
        style={{
          borderBottom: "1px solid rgba(196,112,75,0.12)",
          display: "flex",
          alignItems: "center",
          height: 56,
          padding: "0 32px",
          gap: 0,
          flexShrink: 0,
        }}
      >
        <Link
          href="/profile"
          style={{
            color: "#A89B8C",
            fontSize: 13,
            textDecoration: "none",
            marginRight: 28,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <span style={{ fontSize: 13, color: "#A89B8C", marginRight: 8 }}>Support</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>

        {(["chat", "cases"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0 18px",
              height: 56,
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid #C4704B" : "2px solid transparent",
              color: tab === t ? "#EDE6DD" : "#A89B8C",
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {t === "chat" ? "Support" : "Cases"}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            maxWidth: 720,
            width: "100%",
            margin: "0 auto",
            padding: "0 24px",
            minHeight: 0,
          }}
        >
          {/* Hero — only before first user message */}
          {!hasConversation && (
            <div style={{ paddingTop: 56, paddingBottom: 40, flexShrink: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#22c55e",
                  marginBottom: 20,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                All systems normal.
              </div>
              <h1
                style={{
                  fontSize: 34,
                  fontWeight: 300,
                  color: "#EDE6DD",
                  fontFamily: "var(--font-libre-franklin)",
                  marginBottom: 8,
                  lineHeight: 1.2,
                }}
              >
                cascrow Support
              </h1>
              <p style={{ fontSize: 18, color: "#A89B8C", fontWeight: 300 }}>
                How can we help you today?
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 32,
                }}
              >
                {[
                  {
                    href: "/guide",
                    title: "Read the guide ↗",
                    desc: "Step-by-step walkthrough of the escrow flow — contracts, funding, and proof.",
                  },
                  {
                    href: "mailto:support@cascrow.com",
                    title: "Email us ↗",
                    desc: "Reach our team directly at support@cascrow.com for urgent issues.",
                  },
                ].map((card) => (
                  <a key={card.href} href={card.href} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        padding: "20px 22px",
                        borderRadius: 12,
                        border: "1px solid rgba(196,112,75,0.15)",
                        background: "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor =
                          "rgba(196,112,75,0.4)";
                        (e.currentTarget as HTMLDivElement).style.background =
                          "rgba(196,112,75,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.borderColor =
                          "rgba(196,112,75,0.15)";
                        (e.currentTarget as HTMLDivElement).style.background =
                          "rgba(255,255,255,0.02)";
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#EDE6DD",
                          marginBottom: 6,
                        }}
                      >
                        {card.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#A89B8C", lineHeight: 1.5 }}>
                        {card.desc}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* AI Agent label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingTop: hasConversation ? 24 : 0,
              paddingBottom: 16,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#1a1511",
                border: "1px solid rgba(196,112,75,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C4704B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#EDE6DD" }}>
              cascrow Assistant
            </span>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              paddingBottom: 8,
              minHeight: 0,
            }}
          >
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isAdmin = msg.role === "admin";
              const isSystem = msg.role === "system";

              if (isSystem) {
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "#A89B8C",
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#A89B8C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {msg.content}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    gap: 3,
                  }}
                >
                  {isAdmin && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#C4704B",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        paddingLeft: 2,
                      }}
                    >
                      cascrow team
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "10px 16px",
                      borderRadius: isUser
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: isUser
                        ? "#C4704B"
                        : isAdmin
                        ? "rgba(196,112,75,0.1)"
                        : "rgba(255,255,255,0.05)",
                      border: isAdmin ? "1px solid rgba(196,112,75,0.2)" : undefined,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: isUser ? "#fff" : "#EDE6DD",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  padding: "11px 16px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "rgba(255,255,255,0.05)",
                  display: "inline-flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#A89B8C",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Escalation offer */}
            {cantHelp && !ticketId && (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(196,112,75,0.15)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "#A89B8C",
                    marginBottom: 14,
                    lineHeight: 1.6,
                  }}
                >
                  I wasn&apos;t able to fully resolve this. Want to escalate to a human?
                  Our team will reply directly in this conversation.
                </p>
                <button
                  onClick={createTicket}
                  disabled={creatingTicket}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    background: "#C4704B",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#fff",
                    fontWeight: 600,
                    opacity: creatingTicket ? 0.7 : 1,
                  }}
                >
                  {creatingTicket ? "Creating case…" : "Create support case"}
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Awaiting response status */}
          {ticketId && (
            <div
              style={{
                padding: "11px 16px",
                borderTop: "1px solid rgba(196,112,75,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "#A89B8C",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  flexShrink: 0,
                  boxShadow: "0 0 6px rgba(245,158,11,0.5)",
                }}
              />
              Awaiting response — someone on the support team will help you soon.
              <button
                onClick={() => setTab("cases")}
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#C4704B",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                View case →
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "10px 0 28px", flexShrink: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: "10px 12px 10px 16px",
                borderRadius: 14,
                border: "1px solid rgba(196,112,75,0.2)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={ticketId ? "Continue the conversation…" : "Send a message…"}
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#EDE6DD",
                  fontSize: 14,
                  resize: "none",
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflow: "auto",
                  fontFamily: "inherit",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background:
                    input.trim() && !loading ? "#C4704B" : "rgba(196,112,75,0.15)",
                  border: "none",
                  cursor: input.trim() && !loading ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EDE6DD"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CASES TAB ── */}
      {tab === "cases" && (
        <div
          style={{ maxWidth: 900, width: "100%", margin: "0 auto", padding: "32px 24px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 300,
                color: "#EDE6DD",
                fontFamily: "var(--font-libre-franklin)",
                flex: 1,
              }}
            >
              My Cases
            </h2>
            <button
              onClick={() => setTab("chat")}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "#C4704B",
                border: "none",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New case
            </button>
          </div>

          {/* Search + status filters */}
          <div
            style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
          >
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases…"
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(196,112,75,0.2)",
                background: "rgba(255,255,255,0.03)",
                color: "#EDE6DD",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {(["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor:
                      statusFilter === s ? "#C4704B" : "rgba(196,112,75,0.2)",
                    background:
                      statusFilter === s
                        ? "rgba(196,112,75,0.1)"
                        : "transparent",
                    color: statusFilter === s ? "#C4704B" : "#A89B8C",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: statusFilter === s ? 600 : 400,
                  }}
                >
                  {s
                    ? s.replace("_", " ").charAt(0) +
                      s.replace("_", " ").slice(1).toLowerCase()
                    : "All statuses"}
                </button>
              )
            )}
          </div>

          {ticketsLoading ? (
            <div
              style={{
                textAlign: "center",
                color: "#A89B8C",
                padding: 60,
                fontSize: 13,
              }}
            >
              Loading cases…
            </div>
          ) : filteredTickets.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#A89B8C",
                padding: 60,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                border: "1px solid rgba(196,112,75,0.1)",
                fontSize: 13,
              }}
            >
              {tickets.length === 0
                ? "No cases yet. Start a chat to get help."
                : "No cases match your search."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredTickets.map((ticket, idx) => {
                const isExpanded = expandedTicket === ticket.id;
                const caseNum = `#${String(idx + 1).padStart(8, "0")}`;
                const isOpen =
                  ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";

                return (
                  <div
                    key={ticket.id}
                    style={{
                      border: "1px solid rgba(196,112,75,0.12)",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: isExpanded
                        ? "rgba(196,112,75,0.03)"
                        : "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* Row header */}
                    <div
                      onClick={() =>
                        setExpandedTicket(isExpanded ? null : ticket.id)
                      }
                      style={{
                        padding: "16px 20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#EDE6DD",
                            marginBottom: 3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ticket.subject}{" "}
                          <span
                            style={{
                              color: "#6b7280",
                              fontWeight: 400,
                              fontSize: 12,
                            }}
                          >
                            {caseNum}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#A89B8C" }}>
                          Opened{" "}
                          {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {ticket.updatedAt !== ticket.createdAt &&
                            ` · Last updated ${new Date(ticket.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: PRIORITY_COLORS[ticket.priority] ?? "#A89B8C",
                          flexShrink: 0,
                        }}
                      >
                        {ticket.priority}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: STATUS_COLORS[ticket.status] ?? "#A89B8C",
                          padding: "3px 9px",
                          borderRadius: 4,
                          background: `${STATUS_COLORS[ticket.status] ?? "#6b7280"}18`,
                          flexShrink: 0,
                        }}
                      >
                        {ticket.status === "IN_PROGRESS"
                          ? "In progress"
                          : ticket.status.charAt(0) +
                            ticket.status.slice(1).toLowerCase()}
                      </span>

                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#A89B8C"
                        strokeWidth="2"
                        style={{
                          transform: isExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {/* Transcript */}
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: "1px solid rgba(196,112,75,0.1)",
                          padding: "16px 20px 20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Full Transcript
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          {ticket.messages
                            .filter((m) => m.role !== "system")
                            .map((msg, mi) => {
                              const isU = msg.role === "user";
                              const isA = msg.role === "admin";
                              return (
                                <div
                                  key={mi}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: isU ? "flex-end" : "flex-start",
                                    gap: 3,
                                  }}
                                >
                                  {isA && (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: "#C4704B",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                      }}
                                    >
                                      cascrow team
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      maxWidth: "80%",
                                      padding: "8px 14px",
                                      borderRadius: isU
                                        ? "14px 14px 4px 14px"
                                        : "14px 14px 14px 4px",
                                      background: isU
                                        ? "rgba(196,112,75,0.18)"
                                        : isA
                                        ? "rgba(196,112,75,0.08)"
                                        : "rgba(255,255,255,0.04)",
                                      border: isA
                                        ? "1px solid rgba(196,112,75,0.2)"
                                        : undefined,
                                      fontSize: 13,
                                      lineHeight: 1.5,
                                      color: "#EDE6DD",
                                      whiteSpace: "pre-wrap",
                                    }}
                                  >
                                    {msg.content}
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Status footer */}
                        {isOpen ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              color: "#A89B8C",
                              paddingTop: 4,
                            }}
                          >
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#f59e0b",
                                boxShadow: "0 0 4px rgba(245,158,11,0.5)",
                                flexShrink: 0,
                              }}
                            />
                            Awaiting response — someone on the support team will help
                            you soon.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              color: "#22c55e",
                              paddingTop: 4,
                            }}
                          >
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#22c55e",
                                flexShrink: 0,
                              }}
                            />
                            {ticket.status === "RESOLVED" ? "Resolved" : "Closed"}
                            {ticket.resolvedAt &&
                              ` · ${new Date(ticket.resolvedAt).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" }
                              )}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        ::placeholder { color: #6b7280; }
      `}</style>
    </div>
  );
}
