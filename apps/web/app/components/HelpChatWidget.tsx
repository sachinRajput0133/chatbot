"use client";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LeadCapture {
  enabled: boolean;
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  collect_address: boolean;
}

interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  welcome_message: string;
  lead_capture: LeadCapture | null;
}

const VISITOR_KEY = "cb_help_visitor";
const CONV_KEY = "cb_help_conv";

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function getStoredConvId(): string | null {
  return localStorage.getItem(CONV_KEY);
}

function storeConvId(id: string) {
  localStorage.setItem(CONV_KEY, id);
}

const COLOR = "#0d9488";

export function HelpChatWidget({ side = "left" }: { side?: "left" | "right" }) {
  const [helpBotId, setHelpBotId] = useState<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(false);

  // pre-chat form
  const [showForm, setShowForm] = useState(false);
  const [formDone, setFormDone] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", address: "" });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch platform bot_id + widget config on mount, then restore history if available
  useEffect(() => {
    fetch(`${API_URL}/api/platform/config`)
      .then((r) => r.json())
      .then(async (data) => {
        if (!data?.help_bot_id) return;
        const botId = data.help_bot_id;
        setHelpBotId(botId);

        const cfg = await fetch(`${API_URL}/api/widget-config/${botId}`)
          .then((r) => r.json())
          .catch(() => null);
        if (cfg) setWidgetConfig(cfg);

        // Restore previous conversation from localStorage
        const storedConvId = getStoredConvId();
        if (storedConvId) {
          const visitorId = getVisitorId();
          try {
            const histRes = await fetch(
              `${API_URL}/api/chat/${botId}/history?visitor_id=${encodeURIComponent(visitorId)}&conversation_id=${encodeURIComponent(storedConvId)}`
            );
            if (histRes.ok) {
              const history: Array<{ role: string; content: string }> = await histRes.json();
              if (history.length > 0) {
                setConvId(storedConvId);
                setMessages(history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
                setFormDone(true);
              }
            }
          } catch {
            // ignore — fresh session
          }
        }
      })
      .catch(() => {});
  }, []);

  // When chat opens for the first time decide: show form or go straight to chat
  // Depends on widgetConfig too — config loads async, so we must re-evaluate once it arrives
  useEffect(() => {
    if (!open || formDone) return;
    if (widgetConfig === null) return; // still loading — wait for config to arrive
    const lc = widgetConfig?.lead_capture;
    const hasForm = lc?.enabled && (lc.collect_name || lc.collect_email || lc.collect_phone || lc.collect_address);
    if (hasForm) {
      setShowForm(true);
    } else {
      startChat();
    }
  }, [open, widgetConfig, formDone]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function startChat(welcome?: string) {
    setShowForm(false);
    setFormDone(true);
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: welcome || widgetConfig?.welcome_message || "Hi! How can I help you today?",
        },
      ]);
    }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!helpBotId) return;
    setFormSubmitting(true);
    try {
      const hasInfo = formData.name || formData.email || formData.phone || formData.address;
      if (hasInfo) {
        const res = await fetch(`${API_URL}/api/chat/${helpBotId}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_id: getVisitorId(),
            name: formData.name || undefined,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            address: formData.address || undefined,
            page_url: window.location.href,
          }),
        });
        // Capture the conversation_id so the first chat message continues
        // the same conversation that already has the visitor's contact info.
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.conversation_id) {
            setConvId(data.conversation_id);
            storeConvId(data.conversation_id);
          }
        }
      }
    } catch {
      // silently continue
    } finally {
      setFormSubmitting(false);
      const greeting = formData.name
        ? `Hi ${formData.name}! ${widgetConfig?.welcome_message || "How can I help you today?"}`
        : widgetConfig?.welcome_message || "Hi! How can I help you today?";
      startChat(greeting);
    }
  }

  async function send() {
    if (!input.trim() || !helpBotId || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/${helpBotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          visitor_id: getVisitorId(),
          conversation_id: convId,
          page_url: window.location.href,
          // Pass collected form data so the backend knows what's already provided
          // and won't ask for it again in the AI response.
          user_info: (formData.name || formData.email || formData.phone) ? {
            name: formData.name || undefined,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (data?.conversation_id) {
        setConvId(data.conversation_id);
        storeConvId(data.conversation_id);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data?.reply || "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to connect. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!helpBotId) return null;

  const lc = widgetConfig?.lead_capture;
  const botName = widgetConfig?.bot_name || "Assistant";

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "88px",
            ...(side === "right" ? { right: "20px" } : { left: "20px" }),
            width: "360px",
            maxHeight: "540px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9998,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: COLOR,
              color: "#fff",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{botName}</div>
                <div style={{ fontSize: "11px", opacity: 0.85 }}>● Online</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>

          {/* ── Pre-chat form ── */}
          {showForm ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
              <p style={{ fontSize: "14px", color: "#374151", marginBottom: "16px", lineHeight: 1.5 }}>
                Before we start, share a few details so we can personalise your experience.{" "}
                <span style={{ color: "#6b7280" }}>(All fields optional)</span>
              </p>
              <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {lc?.collect_name && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                      placeholder="John Doe"
                      style={inputStyle}
                    />
                  </div>
                )}
                {lc?.collect_email && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                      placeholder="john@example.com"
                      style={inputStyle}
                    />
                  </div>
                )}
                {lc?.collect_phone && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 555 000 0000"
                      style={inputStyle}
                    />
                  </div>
                )}
                {lc?.collect_address && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                      Mailing Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                      placeholder="123 Main St, City, State"
                      style={inputStyle}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    marginTop: "4px",
                    background: COLOR,
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: formSubmitting ? "not-allowed" : "pointer",
                    opacity: formSubmitting ? 0.7 : 1,
                  }}
                >
                  {formSubmitting ? "Starting…" : "Start Chat →"}
                </button>
                <button
                  type="button"
                  onClick={() => startChat()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#9ca3af",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Skip and start chatting
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding: "10px 14px",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: msg.role === "user" ? COLOR : "#f3f4f6",
                        color: msg.role === "user" ? "#fff" : "#111827",
                        fontSize: "14px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "16px 16px 16px 4px",
                        background: "#f3f4f6",
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      {[0, 1, 2].map((n) => (
                        <span
                          key={n}
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "#9ca3af",
                            display: "inline-block",
                            animation: `bounce 1.2s infinite ${n * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Type a message…"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  style={{
                    background: COLOR,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 14px",
                    cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    opacity: input.trim() && !loading ? 1 : 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={botName}
        style={{
          position: "fixed",
          bottom: "20px",
          ...(side === "right" ? { right: "20px" } : { left: "20px" }),
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: COLOR,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(13,148,136,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
};
