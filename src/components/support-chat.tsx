"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Message {
  role: "user" | "assistant" | "admin" | "system";
  content: string;
}

const PROBLEM_KEYWORDS =
  /can't|cannot|not working|error|broken|stuck|issue|problem|fail|bug|crash|fund|escrow|payment|metamask|wallet|proof|rejected|expired|won't|doesn't|didn't|help/i;

export function SupportChat() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cantHelp, setCantHelp] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [unread, setUnread] = useState(false);
  const [lastAdminMsgCount, setLastAdminMsgCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for open-support-chat event (e.g. from profile page Support section)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(false);
      if (messages.length === 0) {
        setMessages([
          {
            role: "assistant",
            content: "Hi! I'm the cascrow support bot. What can I help you with?",
          },
        ]);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for admin replies once a ticket is open
  const pollAdminReplies = useCallback(async () => {
    if (!ticketId || !session?.user?.id) return;
    try {
      const res = await fetch("/api/support/tickets/mine");
      if (!res.ok) return;
      const data = await res.json();
      const ticket = (data.tickets as Array<{ id: string; messages: Message[] }>).find(
        (t) => t.id === ticketId,
      );
      if (!ticket) return;
      const adminMsgs = ticket.messages.filter((m) => m.role === "admin");
      if (adminMsgs.length > lastAdminMsgCount) {
        const newReplies = adminMsgs.slice(lastAdminMsgCount);
        setLastAdminMsgCount(adminMsgs.length);
        setMessages((prev) => [...prev, ...newReplies]);
        if (!open) setUnread(true);
      }
    } catch {
      // silent
    }
  }, [ticketId, session?.user?.id, lastAdminMsgCount, open]);

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

    // If message looks like a problem report, show a "checking..." system bubble immediately
    const looksLikeProblem = PROBLEM_KEYWORDS.test(text);
    if (looksLikeProblem) {
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
      const reply = data.reply ?? "Sorry, something went wrong.";

      // Remove the "checking" bubble, add the real reply
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.role !== "system");
        return [...filtered, { role: "assistant", content: reply }];
      });
      if (data.cantHelp) setCantHelp(true);
      if (!open) setUnread(true);
    } catch {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.role !== "system");
        return [
          ...filtered,
          { role: "assistant", content: "I'm having trouble right now. Please try again shortly." },
        ];
      });
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (loading) return;
    const subject =
      ticketSubject.trim() ||
      messages.find((m) => m.role === "user")?.content?.slice(0, 80) ||
      "Support request";

    setLoading(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, createTicket: true, subject }),
      });
      const data = await res.json();
      setTicketId(data.ticketId);
      setShowTicketForm(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Ticket created (ID: ${data.ticketId}). Our team will reply here — you'll see their response in this chat. You can also check your tickets in Settings → Support.`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to create ticket. Please email support@cascrow.com directly.",
        },
      ]);
    } finally {
      setLoading(false);
      setCantHelp(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Support chat"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#C4704B",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EDE6DD" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDE6DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread && !open && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 10, height: 10, borderRadius: "50%",
            background: "#ef4444", border: "2px solid #171311",
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 9998,
            width: 360,
            maxWidth: "calc(100vw - 48px)",
            maxHeight: 520,
            borderRadius: 16,
            background: "#1a1511",
            border: "1px solid rgba(196,112,75,0.25)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(196,112,75,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(196,112,75,0.08)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(196,112,75,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#EDE6DD" }}>cascrow support</div>
              <div style={{ fontSize: 11, color: "#A89B8C" }}>
                {ticketId ? `Ticket #${ticketId.slice(-8)} · waiting for reply` : "AI + human support"}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => {
              const isAdmin = msg.role === "admin";
              const isSystem = msg.role === "system";
              return (
                <div key={i}>
                  {isAdmin && (
                    <div style={{ fontSize: 10, color: "#C4704B", fontWeight: 700, marginBottom: 3, textTransform: "uppercase" }}>
                      cascrow team
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "85%",
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      padding: isSystem ? "6px 12px" : "9px 13px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: msg.role === "user"
                        ? "#C4704B"
                        : isAdmin
                        ? "rgba(196,112,75,0.12)"
                        : isSystem
                        ? "transparent"
                        : "rgba(255,255,255,0.06)",
                      border: isAdmin ? "1px solid rgba(196,112,75,0.25)" : isSystem ? "none" : undefined,
                      fontSize: isSystem ? 11 : 13,
                      lineHeight: 1.5,
                      color: msg.role === "user" ? "#fff" : isSystem ? "#A89B8C" : "#EDE6DD",
                      fontStyle: isSystem ? "italic" : "normal",
                      display: isSystem ? "flex" : undefined,
                      alignItems: isSystem ? "center" : undefined,
                      gap: isSystem ? 6 : undefined,
                    }}
                  >
                    {isSystem && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A89B8C" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{
                alignSelf: "flex-start",
                padding: "9px 13px",
                borderRadius: "14px 14px 14px 4px",
                background: "rgba(255,255,255,0.06)",
                display: "flex", gap: 4, alignItems: "center",
              }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#A89B8C",
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            )}

            {/* Offer ticket creation */}
            {cantHelp && !ticketId && !showTicketForm && (
              <div style={{
                alignSelf: "flex-start", width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(196,112,75,0.08)",
                border: "1px solid rgba(196,112,75,0.2)",
                fontSize: 12, color: "#A89B8C",
              }}>
                Want to escalate this to a human? I'll create a ticket and our team will reply here in the chat.
                <button
                  onClick={() => setShowTicketForm(true)}
                  style={{
                    display: "block", marginTop: 8,
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: "#C4704B",
                    border: "none", cursor: "pointer",
                    fontSize: 12, color: "#fff", fontWeight: 600,
                  }}
                >
                  Create support ticket
                </button>
              </div>
            )}

            {/* Ticket form */}
            {showTicketForm && !ticketId && (
              <div style={{
                alignSelf: "flex-start", width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(196,112,75,0.2)",
                fontSize: 12,
              }}>
                <div style={{ color: "#EDE6DD", marginBottom: 8, fontWeight: 500 }}>Describe your issue</div>
                <input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Short summary of the issue"
                  style={{
                    width: "100%", padding: "7px 10px",
                    borderRadius: 6, border: "1px solid rgba(196,112,75,0.25)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#EDE6DD", fontSize: 12,
                    outline: "none", boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={createTicket}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderRadius: 6, background: "#C4704B",
                      border: "none", cursor: "pointer",
                      fontSize: 12, color: "#fff", fontWeight: 600,
                    }}
                  >
                    {loading ? "Creating…" : "Submit ticket"}
                  </button>
                  <button
                    onClick={() => setShowTicketForm(false)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 6, background: "transparent",
                      border: "1px solid rgba(196,112,75,0.3)",
                      cursor: "pointer", fontSize: 12, color: "#A89B8C",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input — always visible; hint when ticket open */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(196,112,75,0.12)",
            display: "flex", gap: 8, alignItems: "center",
            background: "rgba(0,0,0,0.2)",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={ticketId ? "Continue the conversation…" : "Ask a question…"}
              disabled={loading}
              style={{
                flex: 1, padding: "8px 12px",
                borderRadius: 20,
                border: "1px solid rgba(196,112,75,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "#EDE6DD", fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34,
                borderRadius: "50%",
                background: input.trim() && !loading ? "#C4704B" : "rgba(196,112,75,0.2)",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EDE6DD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
