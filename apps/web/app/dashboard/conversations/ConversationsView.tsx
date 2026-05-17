"use client";
import { useEffect, useRef, useState, useCallback } from "react";
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

interface ConversationsViewProps {
  initialOpenId?: string;
  embedded?: boolean;
}

export default function ConversationsView({ initialOpenId, embedded = false }: ConversationsViewProps) {
  const router = useRouter();

  // ── State ──
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [convPage, setConvPage] = useState(1);
  const [hasMoreConvs, setHasMoreConvs] = useState(true);
  const [loadingMoreConvs, setLoadingMoreConvs] = useState(false);
  const [tenant, setTenant] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const [agentInput, setAgentInput] = useState("");
  const [sendingAgent, setSendingAgent] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversation" | "timeline">("conversation");

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollMessagesToBottom = useCallback((smooth = true) => {
    const el = messagesEndRef.current;
    const container = el?.parentElement as HTMLElement | null | undefined;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const openHandledRef = useRef(false);

  // ── Load data ──
  useEffect(() => {
    // Force body to not scroll to prevent dashboard double scrollbars
    document.body.style.overflow = "hidden";
    api.me().then(res => setTenant(res.tenant)).catch(() => { });
    loadPage(1);
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  async function loadPage(page: number) {
    try {
      const res = await api.listConversations(page);
      if (page === 1) setConversations(res);
      else setConversations(prev => [...prev, ...res]);
      setHasMoreConvs(res.length === 20);
    } catch (err) {
      if ((err as any)?.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  // ── Auto-open ──
  useEffect(() => {
    if (openHandledRef.current || loading || !initialOpenId) return;
    openHandledRef.current = true;
    const found = conversations.find((c) => c.id === initialOpenId);
    if (found) openConversation(found);
    else {
      api.getConversation(initialOpenId).then((conv) => {
        setConversations((prev) => prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]);
        openConversation(conv);
      }).catch(() => {});
    }
  }, [loading, conversations, initialOpenId]);

  // ── Real-time ──
  useEffect(() => {
    if (!tenant?.id) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || "localhost:8000";
    const ws = new WebSocket(`${protocol}//${baseUrl}/ws/tenant/${tenant.id}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message") {
        const { conversation_id, message } = data;
        setConversations((prev) => {
          const idx = prev.findIndex(c => c.id === conversation_id);
          if (idx === -1) {
            api.listConversations(1).then(setConversations);
            return prev;
          }
          const existing = prev[idx];
          const updated = {
            ...existing,
            last_message_at: message.created_at,
            message_count: (existing.message_count || 0) + 1,
            is_unread: selected?.id !== conversation_id ? true : existing.is_unread,
            unread_count: selected?.id !== conversation_id ? (existing.unread_count || 0) + 1 : 0
          };
          const others = prev.filter(c => c.id !== conversation_id);
          return [updated, ...others];
        });

        if (selected?.id === conversation_id) {
          setMessages((prev) => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
          api.markAsRead(conversation_id).catch(() => {});
          requestAnimationFrame(() => scrollMessagesToBottom(true));
        }
      }
    };
    return () => ws.close();
  }, [tenant, selected?.id]);

  // ── Actions ──
  async function openConversation(conv: any) {
    setSelected(conv);
    setMessages([]);
    setMsgLoading(true);
    if (!embedded) {
      window.history.replaceState(null, "", `/dashboard/conversations/${conv.id}`);
    }
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, is_unread: false, unread_count: 0 } : c));

    try {
      api.markAsRead(conv.id).catch(() => {});
      const [page, fresh] = await Promise.all([api.getMessages(conv.id), api.getConversation(conv.id)]);
      setMessages(page.messages);
      setHasMore(page.has_more);
      setNextCursor(page.next_cursor);
      setSelected(fresh);
      requestAnimationFrame(() => scrollMessagesToBottom(false));
    } finally {
      setMsgLoading(false);
    }
  }

  async function toggleMode() {
    if (!selected) return;
    const newMode = selected.mode === "human" ? "ai" : "human";
    try {
      const updated = await api.setConversationMode(selected.id, newMode);
      setSelected(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) { console.error(err); }
  }

  async function handleSendAgent() {
    if (!selected || !agentInput.trim() || sendingAgent) return;
    setSendingAgent(true);
    try {
      const newMsg = await api.sendAgentReply(selected.id, agentInput);
      setAgentInput("");
      setMessages(prev => [...prev, newMsg]);
      setSelected(prev => prev ? { ...prev, last_message_at: newMsg.created_at } : null);
      requestAnimationFrame(() => scrollMessagesToBottom(true));
    } catch (err) { console.error(err); } 
    finally { setSendingAgent(false); }
  }

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.visitor_name || "").toLowerCase().includes(q) || (c.visitor_id || "").toLowerCase().includes(q);
  });

  return (
    <div className={`flex flex-col w-full bg-[#F8FAFC] overflow-hidden ${embedded ? "h-full" : "h-[calc(100vh-64px)]"}`} style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* ── Page Header ── */}
      <div className="px-8 py-4 shrink-0 flex items-center justify-between w-full bg-[#F8FAFC]">
        <div className="flex items-center gap-4">
          {leftCollapsed && (
            <button 
              onClick={() => setLeftCollapsed(false)}
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-violet-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined">menu_open</span>
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Conversations</h1>
            <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">Manage and analyze your bot conversations in one place.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none cursor-pointer shadow-sm hover:border-slate-300 transition-colors">
            <option>All Time</option>
            <option>Today</option>
          </select>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-600 uppercase">1 Active Session</span>
          </div>
          {rightCollapsed && (
            <button 
              onClick={() => setRightCollapsed(false)}
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-violet-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined">dock_to_left</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden px-8 pb-6 gap-4 w-full min-h-0">
        {/* ── Left: Session List ── */}
        <aside className={`transition-all duration-300 ease-in-out shrink-0 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm ${
          leftCollapsed ? "w-0 opacity-0 -translate-x-full pointer-events-none" : "w-72"
        }`}>
          <div className="p-5 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">Session List</h2>
              <span className="bg-violet-50 text-violet-600 text-[10px] font-bold px-1.5 py-0.5 rounded">{conversations.length} Total</span>
            </div>
            <button onClick={() => setLeftCollapsed(true)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keyboard_double_arrow_left</span>
            </button>
          </div>
          <div className="p-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>search</span>
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-3 text-xs outline-none focus:border-violet-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filtered.map(conv => {
              const isActive = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    isActive ? "bg-white border-violet-200 shadow-md ring-4 ring-violet-50" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 18 }}>person</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {conv.visitor_name || `Visitor #${conv.visitor_id?.slice(-6).toUpperCase()}`}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate font-medium">{conv.page_url || "Dashboard"}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-2">{timeAgo(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{conv.message_count || 0} messages</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Center: Chat Area ── */}
        <main className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 40 }}>forum</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">Select a conversation</h3>
              <p className="text-xs text-slate-400 mt-1">Manage and analyze your bot conversations in one place.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="h-24 bg-white border-b border-slate-50 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    onClick={() => setLeftCollapsed(!leftCollapsed)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${
                      leftCollapsed ? "bg-violet-50 border-violet-100 text-violet-600" : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600"
                    }`}
                    title={leftCollapsed ? "Show Session List" : "Hide Session List"}
                  >
                    <span className="material-symbols-outlined">{leftCollapsed ? "menu_open" : "menu"}</span>
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-orange-500" style={{ fontSize: 28 }}>person</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-slate-900 truncate max-w-[200px]">
                        {selected.visitor_name || `Visitor #${selected.visitor_id?.slice(-6).toUpperCase()}`}
                      </h3>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase rounded border border-emerald-100/50">Live</span>
                      <span className="px-1.5 py-0.5 bg-violet-50 text-violet-600 text-[9px] font-black uppercase rounded border border-violet-100/50">Human Mode</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span className="truncate max-w-[250px]">{selected.page_url || "http://localhost:3001/dashboard"}</span>
                      <span className="text-slate-300">·</span>
                      <span>Started {formatTime(selected.started_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden xl:block mr-2">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">4 messages</div>
                  </div>
                  <button 
                    onClick={toggleMode}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-100 outline-none active:scale-95"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{selected.mode === 'human' ? 'smart_toy' : 'person'}</span>
                    {selected.mode === 'human' ? 'Resume AI' : 'Takeover'}
                  </button>
                  <button 
                    onClick={() => setRightCollapsed(!rightCollapsed)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${
                      rightCollapsed ? "bg-violet-50 border-violet-100 text-violet-600" : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600"
                    }`}
                    title={rightCollapsed ? "Show Metadata" : "Hide Metadata"}
                  >
                    <span className="material-symbols-outlined">{rightCollapsed ? "dock_to_left" : "dock_to_right"}</span>
                  </button>
                  <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-colors">
                    <span className="material-symbols-outlined">more_horiz</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b border-slate-50 bg-white flex items-center gap-8 shrink-0">
                <button 
                  onClick={() => setActiveTab("conversation")}
                  className={`py-4 text-xs font-bold border-b-2 transition-all relative ${
                    activeTab === "conversation" ? "text-violet-600 border-violet-600" : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
                >
                  Conversation
                </button>
                <button 
                  onClick={() => setActiveTab("timeline")}
                  className={`py-4 text-xs font-bold border-b-2 transition-all relative ${
                    activeTab === "timeline" ? "text-violet-600 border-violet-600" : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
                >
                  Events Timeline
                </button>
              </div>

              {/* Messages */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 bg-slate-50/10 space-y-8 custom-scrollbar"
              >
                {msgLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Conversation</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 py-2">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-4">Today</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {messages.map((msg, i) => {
                      const isUser = msg.role === "user";
                      const isAgent = msg.role === "agent";
                      const isBot = msg.role === "assistant";
                      
                      return (
                        <div key={msg.id || i} className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
                          {!isUser && (
                            <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
                              isBot ? "bg-orange-50 text-orange-500 border border-orange-100" : "bg-violet-50 text-violet-500 border border-violet-100"
                            }`}>
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                {isBot ? "smart_toy" : "person"}
                              </span>
                            </div>
                          )}
                          <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[75%]`}>
                            <div className={`px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                              isUser ? "bg-violet-600 text-white rounded-tr-none shadow-violet-100" : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                            }`}>
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-slate-300 mt-1.5 font-bold uppercase tracking-wide">{formatTime(msg.created_at)}</span>
                          </div>
                          {isUser && (
                            <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 relative shadow-sm">
                              <span className="material-symbols-outlined text-violet-500" style={{ fontSize: 20 }}>person</span>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Event indicators */}
                    <div className="flex justify-center py-4">
                      <div className="px-5 py-2 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 shadow-sm">
                        <span className="material-symbols-outlined text-orange-400" style={{ fontSize: 18 }}>magic_button</span>
                        <span className="text-[11px] font-bold text-slate-600">Assigned to Human Agent</span>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase">3:58 PM</span>
                      </div>
                    </div>

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="p-6 bg-white border-t border-slate-50 shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="relative group">
                    <textarea
                      value={agentInput}
                      onChange={e => setAgentInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendAgent())}
                      placeholder="Type your reply as a human agent..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-6 py-5 text-sm outline-none focus:border-violet-500 focus:bg-white transition-all resize-none min-h-[64px] max-h-32 shadow-inner pr-24"
                    />
                    <div className="absolute left-6 bottom-4 flex items-center gap-1.5">
                      <button className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>attach_file</span>
                      </button>
                      <button className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>mood</span>
                      </button>
                      <button className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-all">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                      </button>
                    </div>
                    <div className="absolute right-4 bottom-4 flex items-center gap-2">
                       <div className="flex items-center overflow-hidden rounded-2xl shadow-lg shadow-violet-100">
                          <button 
                            onClick={handleSendAgent}
                            disabled={!agentInput.trim() || sendingAgent}
                            className="bg-violet-600 text-white px-5 py-3 flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>send</span>
                          </button>
                          <button className="bg-violet-600 text-white px-2 py-3 flex items-center justify-center hover:bg-violet-700 transition-colors border-l border-violet-500/20">
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>keyboard_arrow_down</span>
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* ── Right: Metadata Sidebar ── */}
        <aside className={`transition-all duration-300 ease-in-out shrink-0 bg-white rounded-3xl border border-slate-200 overflow-y-auto custom-scrollbar shadow-sm ${
          rightCollapsed ? "w-0 opacity-0 translate-x-full pointer-events-none p-0" : "w-[300px] p-6"
        }`}>
          <div className="flex items-center justify-between group cursor-pointer mb-8">
             <div className="flex items-center gap-2.5">
               <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 20 }}>view_quilt</span>
               <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Metadata & Context</h4>
             </div>
             <button onClick={() => setRightCollapsed(true)} className="text-slate-400 hover:text-slate-600">
               <span className="material-symbols-outlined">keyboard_double_arrow_right</span>
             </button>
          </div>

          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 block">Active Page</label>
              <div className="flex items-center gap-2.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all cursor-pointer">
                <span className="text-[11px] text-slate-600 truncate flex-1 font-medium">{selected?.page_url || "http://localhost:3001/dashboard"}</span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-violet-600" style={{ fontSize: 18 }}>open_in_new</span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">Session Info</label>
              <div className="space-y-3.5">
                 {[
                   { icon: "chat", label: "Messages", value: selected?.message_count || messages.length },
                   { icon: "schedule", label: "Started", value: selected?.started_at ? new Date(selected.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "May 10, 2026" },
                   { icon: "history", label: "Last Active", value: timeAgo(selected?.last_message_at) + " ago" },
                   { icon: "source", label: "Source", value: "Web Widget" },
                 ].map(item => (
                   <div key={item.label} className="flex items-center justify-between px-1">
                     <div className="flex items-center gap-3">
                       <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 18 }}>{item.icon}</span>
                       <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{item.label}</span>
                     </div>
                     <span className="text-[11px] font-black text-slate-700">{item.value}</span>
                   </div>
                 ))}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2.5">
                   <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 20 }}>info</span>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Customer Info</label>
                 </div>
                 <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:text-slate-600" style={{ fontSize: 18 }}>keyboard_arrow_up</span>
               </div>
               <div className="space-y-4 pt-1">
                 {[
                   { icon: "person", label: "Name", value: selected?.visitor_name || "-" },
                   { icon: "mail", label: "Email", value: selected?.visitor_email || "-" },
                   { icon: "call", label: "Phone", value: selected?.visitor_phone || "-" },
                   { icon: "location_on", label: "Address", value: selected?.visitor_address || "-" },
                 ].map(item => (
                   <div key={item.label} className="flex items-center justify-between px-1">
                     <div className="flex items-center gap-3">
                       <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 18 }}>{item.icon}</span>
                       <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{item.label}</span>
                     </div>
                     <span className="text-[11px] font-black text-slate-700">{item.value}</span>
                   </div>
                 ))}
                 <button className="w-full py-3 bg-white border border-violet-200 text-violet-600 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-violet-50 transition-all flex items-center justify-center gap-2 mt-3 shadow-sm hover:shadow-md active:scale-[0.98]">
                   <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                   Add to Contacts
                 </button>
               </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 block">Visitor ID</label>
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl group cursor-pointer hover:bg-white hover:shadow-md transition-all">
                <span className="text-[10px] font-mono text-slate-400 truncate flex-1">{selected?.visitor_id || "v_x1kb1n7q8s9mo2mmzwh"}</span>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-slate-500" style={{ fontSize: 16 }}>content_copy</span>
              </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 block">Location</label>
               <div className="flex items-center gap-3 px-1">
                  <div className="w-6 h-4 bg-slate-100 rounded-sm overflow-hidden flex-shrink-0 shadow-sm border border-slate-200/50">
                     <img src="https://flagcdn.com/us.svg" alt="USA" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">New York, USA</span>
               </div>
            </div>

          </div>
        </aside>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}
