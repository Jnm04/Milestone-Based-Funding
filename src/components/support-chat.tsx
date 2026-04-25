"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function SupportChat() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cantHelp, setCantHelp] = useState(false);
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setCantHelp(false);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const reply = data.reply ?? "Sorry, something went wrong.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (data.cantHelp) setCantHelp(true);
      if (!open) setUnread(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble right now. Please try again shortly." },
      ]);
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
      setTicketCreated(data.ticketId);
      setShowTicketForm(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Your ticket has been created (ID: ${data.ticketId}). Our team will get back to you at ${session?.user?.email ?? "your email"}.`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to create ticket. Please email support@cascrow.com directly." },
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
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#EDE6DD" }}>cascrow support</div>
              <div style={{ fontSize: 11, color: "#A89B8C" }}>Usually replies instantly</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  maxWidth: "85%",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  padding: "9px 13px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? "#C4704B" : "rgba(255,255,255,0.06)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: msg.role === "user" ? "#fff" : "#EDE6DD",
                }}
              >
                {msg.content}
              </div>
            ))}

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
            {cantHelp && !ticketCreated && !showTicketForm && (
              <div style={{
                alignSelf: "flex-start", width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(196,112,75,0.08)",
                border: "1px solid rgba(196,112,75,0.2)",
                fontSize: 12, color: "#A89B8C",
              }}>
                Want to escalate this to a human?
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
            {showTicketForm && !ticketCreated && (
              <div style={{
                alignSelf: "flex-start", width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(196,112,75,0.2)",
                fontSize: 12,
              }}>
                <div style={{ color: "#EDE6DD", marginBottom: 8, fontWeight: 500 }}>Create a ticket</div>
                <input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Short subject (optional)"
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

          {/* Input */}
          {!ticketCreated && (
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
                placeholder="Ask a question…"
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
          )}
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
