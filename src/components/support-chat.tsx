"use client";

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";

interface Message {
  role: "user" | "assistant" | "admin" | "system";
  content: string;
}

const PROBLEM_KEYWORDS =
  /can't|cannot|not working|error|broken|stuck|issue|problem|fail|bug|crash|fund|escrow|payment|metamask|wallet|proof|rejected|expired|won't|doesn't|didn't|help/i;

const LS_MESSAGES = "cascrow-support-messages";
const LS_TICKET = "cascrow-support-ticket";

const QUICK_REPLIES = [
  "MetaMask not working",
  "Proof was rejected",
  "How to fund escrow?",
  "Contract is stuck",
];

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function renderMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={nodes.length} style={{ margin: "4px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={nodes.length} style={{ margin: "4px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    nodes.push(<p key={nodes.length} style={{ margin: 0 }}>{inlineMarkdown(line)}</p>);
    i++;
  }

  return nodes;
}

function inlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={{ background: "hsl(28 18% 14%)", borderRadius: 3, padding: "1px 4px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function SupportChat() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => loadLS<Message[]>(LS_MESSAGES, []));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cantHelp, setCantHelp] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(() => loadLS<string | null>(LS_TICKET, null));
  const [ticketSubject, setTicketSubject] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [unread, setUnread] = useState(false);
  const [lastAdminMsgCount, setLastAdminMsgCount] = useState<number>(
    () => loadLS<Message[]>(LS_MESSAGES, []).filter((m) => m.role === "admin").length,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_MESSAGES, JSON.stringify(messages.filter((m) => m.role !== "system")));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      if (ticketId) localStorage.setItem(LS_TICKET, ticketId);
      else localStorage.removeItem(LS_TICKET);
    } catch {}
  }, [ticketId]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(false);
      if (messages.length === 0) {
        const firstName = session?.user?.name?.split(" ")[0];
        setMessages([{
          role: "assistant",
          content: `Hi${firstName ? ` ${firstName}` : ""}! I'm the cascrow support bot. What can I help you with?`,
        }]);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function clearChat() {
    setMessages([]);
    setTicketId(null);
    setCantHelp(false);
    setShowTicketForm(false);
    setLastAdminMsgCount(0);
    try {
      localStorage.removeItem(LS_MESSAGES);
      localStorage.removeItem(LS_TICKET);
    } catch {}
  }

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

  async function send(overrideText?: string) {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    if (overrideText === undefined) setInput("");
    setLoading(true);
    setCantHelp(false);

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
      [...messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 80) ||
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

  const showQuickReplies = messages.length === 1 && messages[0].role === "assistant" && !ticketId && !loading;
  const canSend = !!input.trim() && !loading;

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
          background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px hsl(22 55% 54% / 0.35)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 6px 32px hsl(22 55% 54% / 0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 24px hsl(22 55% 54% / 0.35)";
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(24 14% 6%)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(24 14% 6%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread && !open && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 10, height: 10, borderRadius: "50%",
            background: "hsl(0 72% 51%)",
            border: "2px solid hsl(24 14% 4%)",
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
            borderRadius: 20,
            background: "hsl(24 12% 6%)",
            border: "1px solid hsl(28 18% 14%)",
            boxShadow: "0 24px 64px hsl(0 0% 0% / 0.6), 0 0 0 1px hsl(22 55% 54% / 0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid hsl(28 18% 14%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "hsl(22 55% 54% / 0.06)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(24 14% 6%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(32 35% 92%)" }}>cascrow support</div>
              <div style={{ fontSize: 11, color: "hsl(30 10% 62%)", fontFamily: "'JetBrains Mono', monospace" }}>
                {ticketId ? `#${ticketId.slice(-8)} · waiting for reply` : "AI + human support"}
              </div>
            </div>
            {messages.length > 1 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "hsl(30 10% 62%)", padding: 4, borderRadius: 6,
                  display: "flex", alignItems: "center",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(32 35% 92%)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(30 10% 62%)")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => {
              const isAdmin = msg.role === "admin";
              const isSystem = msg.role === "system";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {isAdmin && (
                    <div style={{ fontSize: 10, color: "hsl(22 55% 54%)", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                      cascrow team
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: isSystem ? "6px 12px" : "9px 13px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)"
                        : isAdmin
                        ? "hsl(22 55% 54% / 0.1)"
                        : isSystem
                        ? "transparent"
                        : "hsl(28 18% 14% / 0.8)",
                      border: isAdmin
                        ? "1px solid hsl(22 55% 54% / 0.25)"
                        : isSystem
                        ? "none"
                        : msg.role === "user"
                        ? "none"
                        : "1px solid hsl(28 18% 18%)",
                      fontSize: isSystem ? 11 : 13,
                      lineHeight: 1.55,
                      color: msg.role === "user" ? "hsl(24 14% 6%)" : isSystem ? "hsl(30 10% 62%)" : "hsl(32 35% 92%)",
                      fontStyle: isSystem ? "italic" : "normal",
                      display: isSystem ? "flex" : undefined,
                      alignItems: isSystem ? "center" : undefined,
                      gap: isSystem ? 6 : undefined,
                    }}
                  >
                    {isSystem && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(30 10% 62%)" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    {(msg.role === "assistant" || msg.role === "admin") ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              );
            })}

            {/* Quick-reply chips */}
            {showQuickReplies && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 2 }}>
                {QUICK_REPLIES.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 99,
                      border: "1px solid hsl(22 55% 54% / 0.3)",
                      background: "hsl(22 55% 54% / 0.07)",
                      color: "hsl(22 55% 54%)",
                      fontSize: 11,
                      cursor: "pointer",
                      transition: "background 0.15s, border-color 0.15s",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "hsl(22 55% 54% / 0.15)";
                      e.currentTarget.style.borderColor = "hsl(22 55% 54% / 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "hsl(22 55% 54% / 0.07)";
                      e.currentTarget.style.borderColor = "hsl(22 55% 54% / 0.3)";
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{
                alignSelf: "flex-start",
                padding: "10px 14px",
                borderRadius: "14px 14px 14px 4px",
                background: "hsl(28 18% 14% / 0.8)",
                border: "1px solid hsl(28 18% 18%)",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "hsl(30 10% 62%)",
                    animation: "cs-pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            )}

            {/* Offer ticket creation */}
            {cantHelp && !ticketId && !showTicketForm && (
              <div style={{
                alignSelf: "flex-start", width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                background: "hsl(22 55% 54% / 0.06)",
                border: "1px solid hsl(22 55% 54% / 0.2)",
                fontSize: 12, color: "hsl(30 10% 62%)",
              }}>
                Want to escalate this to a human? I&apos;ll create a ticket and our team will reply here.
                <button
                  onClick={() => setShowTicketForm(true)}
                  style={{
                    display: "block", marginTop: 10,
                    padding: "7px 16px",
                    borderRadius: 99,
                    background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
                    border: "none", cursor: "pointer",
                    fontSize: 12, color: "hsl(24 14% 6%)", fontWeight: 600,
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
                padding: "12px 14px",
                borderRadius: 12,
                background: "hsl(24 12% 6% / 0.8)",
                border: "1px solid hsl(28 18% 18%)",
                fontSize: 12,
              }}>
                <div style={{ color: "hsl(32 35% 92%)", marginBottom: 8, fontWeight: 500 }}>Describe your issue</div>
                <input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Short summary of the issue"
                  style={{
                    width: "100%", padding: "8px 11px",
                    borderRadius: 8, border: "1px solid hsl(28 18% 18%)",
                    background: "hsl(28 18% 10%)",
                    color: "hsl(32 35% 92%)", fontSize: 12,
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
                      borderRadius: 99,
                      background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
                      border: "none", cursor: "pointer",
                      fontSize: 12, color: "hsl(24 14% 6%)", fontWeight: 600,
                    }}
                  >
                    {loading ? "Creating…" : "Submit ticket"}
                  </button>
                  <button
                    onClick={() => setShowTicketForm(false)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 99,
                      background: "transparent",
                      border: "1px solid hsl(28 18% 18%)",
                      cursor: "pointer", fontSize: 12, color: "hsl(30 10% 62%)",
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
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid hsl(28 18% 14%)",
            display: "flex", gap: 8, alignItems: "flex-end",
            background: "hsl(24 14% 4% / 0.6)",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                  if (inputRef.current) inputRef.current.style.height = "auto";
                }
              }}
              placeholder={ticketId ? "Continue the conversation…" : "Ask a question…"}
              disabled={loading}
              style={{
                flex: 1, padding: "9px 13px",
                borderRadius: 14,
                border: "1px solid hsl(28 18% 18%)",
                background: "hsl(28 18% 10%)",
                color: "hsl(32 35% 92%)", fontSize: 13,
                outline: "none",
                resize: "none",
                overflowY: "auto",
                lineHeight: 1.5,
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(22 55% 54% / 0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(28 18% 18%)")}
            />
            <button
              onClick={() => send()}
              disabled={!canSend}
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: canSend
                  ? "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)"
                  : "hsl(28 18% 14%)",
                border: "none",
                cursor: canSend ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => { if (canSend) e.currentTarget.style.transform = "scale(1.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={canSend ? "hsl(24 14% 6%)" : "hsl(30 10% 62%)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cs-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
