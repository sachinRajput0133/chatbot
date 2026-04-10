"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listConversations()
      .then(setConversations)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(conv: any) {
    setSelected(conv);
    const msgs = await api.getMessages(conv.id);
    setMessages(msgs);
  }

  const filtered = conversations.filter((c) =>
    search === "" ||
    c.visitor_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.page_url?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col" style={{ height: "100vh", fontFamily: "'Manrope', sans-serif" }}>

      {/* Top Header */}
      <header className="h-20 bg-white/80 backdrop-blur-md flex justify-between items-center px-10 border-b border-gray-100 shrink-0 z-10">
        <div className="flex items-center gap-10">
          <h1 className="font-extrabold text-2xl text-gray-900 tracking-tight">Conversations</h1>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400" style={{ fontSize: "18px" }}>
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across all sessions..."
              className="pl-11 pr-6 py-2.5 rounded-full bg-gray-100 border-none outline-none w-80 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {conversations.length} Sessions
          </span>
        </div>
      </header>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Session List ── */}
        <section className="w-80 shrink-0 flex flex-col border-r border-gray-100 overflow-hidden" style={{ backgroundColor: "#f3f4f5" }}>
          <div className="p-6 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Session List</span>
            {!loading && (
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest">
                {conversations.length} Total
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
            {loading ? (
              <div className="text-gray-400 text-sm font-bold text-center py-10">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <span className="material-symbols-outlined text-gray-300" style={{ fontSize: "28px" }}>forum</span>
                </div>
                <p className="text-gray-400 text-xs font-bold">No conversations yet</p>
                <p className="text-gray-300 text-xs mt-1">Share your embed code to start</p>
              </div>
            ) : (
              filtered.map((conv) => {
                const isActive = selected?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full text-left p-5 rounded-2xl transition-all duration-200 border ${
                      isActive
                        ? "bg-white shadow-sm border-orange-200 ring-1 ring-orange-100"
                        : "border-transparent hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {conv.visitor_name || `Visitor #${conv.visitor_id?.slice(-6).toUpperCase()}`}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0 ml-2">
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
                      {conv.visitor_email || conv.page_url || "No page URL"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {conv.message_count ?? 0} messages
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ── Center: Message Transcript ── */}
        <section className="flex-1 flex flex-col overflow-hidden bg-white">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#a93200" + "15" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#a93200", fontVariationSettings: "'FILL' 1" }}>
                  chat
                </span>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 mb-1">Select a conversation</p>
                <p className="text-sm text-gray-400">Click a session from the list to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-10 py-5 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#a93200" + "15" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#a93200", fontVariationSettings: "'FILL' 1" }}>
                      person
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-gray-900 leading-tight">
                        {selected.visitor_name || `Visitor #${selected.visitor_id?.slice(-6).toUpperCase()}`}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-green-100 text-[10px] font-black text-green-700 uppercase">
                        Live
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {selected.visitor_email && (
                        <span className="text-xs text-orange-600 font-medium">{selected.visitor_email}</span>
                      )}
                      {selected.visitor_phone && (
                        <span className="text-xs text-gray-400 font-medium">{selected.visitor_phone}</span>
                      )}
                      {!selected.visitor_email && (
                        <span className="text-xs text-gray-400 font-medium">{selected.page_url || "Unknown page"}</span>
                      )}
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400 font-medium">Started {formatTime(selected.started_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400">
                    {selected.message_count ?? messages.length} messages
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-10 py-10 flex flex-col items-center">
                <div className="w-full max-w-3xl space-y-10 pb-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10">No messages in this conversation</div>
                  ) : (
                    messages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-5 w-full ${isUser ? "flex-row-reverse" : ""}`}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white shadow-md`}
                            style={{ backgroundColor: isUser ? "#191c1d" : "#a93200" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}
                            >
                              {isUser ? "person" : "smart_toy"}
                            </span>
                          </div>

                          {/* Bubble + timestamp */}
                          <div className={`space-y-2 flex flex-col ${isUser ? "items-end" : "items-start"} flex-1`}>
                            <div
                              className={`px-6 py-4 text-sm leading-relaxed ${
                                isUser
                                  ? "text-white rounded-[2rem] rounded-tr-none"
                                  : "text-gray-700 rounded-[2rem] rounded-tl-none bg-gray-100 border border-gray-200"
                              }`}
                              style={isUser ? { backgroundColor: "#a93200" } : {}}
                            >
                              {msg.content}
                            </div>
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                              {isUser ? "Visitor" : "Bot"} · {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Right: Metadata Sidebar ── */}
        {selected && (
          <aside className="hidden xl:flex w-72 shrink-0 flex-col overflow-y-auto p-7 border-l border-gray-100" style={{ backgroundColor: "#f3f4f5" }}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-7">Metadata & Context</h4>

            <div className="space-y-8">
              {/* Page URL */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Page</label>
                <div className="p-3.5 rounded-2xl bg-white text-xs font-bold truncate border border-gray-200 shadow-sm text-orange-600">
                  {selected.page_url || "—"}
                </div>
              </div>

              {/* Session Info */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Session Info</label>
                <div className="space-y-2">
                  {[
                    { label: "Messages", value: selected.message_count ?? messages.length },
                    { label: "Started", value: selected.started_at ? new Date(selected.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—" },
                    { label: "Last Active", value: timeAgo(selected.last_message_at) + " ago" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white text-[12px] border border-gray-200 shadow-sm"
                    >
                      <span className="text-gray-400 font-medium">{item.label}</span>
                      <span className="font-black text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Identity */}
              {(selected.visitor_name || selected.visitor_email || selected.visitor_phone || selected.external_user_id) && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identity</label>
                  <div className="space-y-2">
                    {selected.visitor_name && (
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white text-[12px] border border-gray-200 shadow-sm">
                        <span className="text-gray-400 font-medium">Name</span>
                        <span className="font-black text-gray-900">{selected.visitor_name}</span>
                      </div>
                    )}
                    {selected.visitor_email && (
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white text-[12px] border border-gray-200 shadow-sm">
                        <span className="text-gray-400 font-medium">Email</span>
                        <span className="font-bold text-orange-600 truncate ml-2 max-w-[140px]">{selected.visitor_email}</span>
                      </div>
                    )}
                    {selected.visitor_phone && (
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white text-[12px] border border-gray-200 shadow-sm">
                        <span className="text-gray-400 font-medium">Phone</span>
                        <span className="font-black text-gray-900">{selected.visitor_phone}</span>
                      </div>
                    )}
                    {selected.external_user_id && (
                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white text-[12px] border border-gray-200 shadow-sm">
                        <span className="text-gray-400 font-medium">User ID</span>
                        <span className="font-mono text-[10px] text-gray-500 truncate ml-2 max-w-[140px]">{selected.external_user_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Visitor ID */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visitor ID</label>
                <div className="p-3.5 rounded-2xl bg-white text-[10px] font-mono text-gray-500 break-all border border-gray-200 shadow-sm">
                  {selected.visitor_id}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tags</label>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest border border-orange-200">
                    Web Chat
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                    {selected.visitor_name ? "Identified" : "Visitor"}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
