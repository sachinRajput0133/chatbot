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

type StatusFilter = "all" | "open" | "pending" | "resolved" | "closed";
type ConversationStatus = "open" | "pending" | "resolved" | "closed";

const STATUS_STYLES: Record<ConversationStatus, string> = {
  open: "bg-blue-50 text-blue-600 border-blue-100",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-100",
  resolved: "bg-emerald-50 text-emerald-600 border-emerald-100",
  closed: "bg-slate-100 text-slate-500 border-slate-200",
};

function StatusPill({ status }: { status?: string }) {
  const s = (status as ConversationStatus) || "open";
  const cls = STATUS_STYLES[s] ?? STATUS_STYLES.open;
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded border ${cls}`}>
      {s}
    </span>
  );
}

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

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
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [activeTab, setActiveTab] = useState<"conversation" | "timeline">("conversation");

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [transcriptToast, setTranscriptToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);

  const [rating, setRating] = useState<{ rating: number; comment: string | null; created_at: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignFilter, setAssignFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [members, setMembers] = useState<{ id: string; email: string }[]>([]);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

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
    api.me().then(res => {
      setTenant(res.tenant);
      setCurrentUserId(res.user?.id ?? null);
    }).catch(() => { });
    api.listMembers().then(setMembers).catch(() => { });
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, assignFilter]);

  async function loadPage(page: number) {
    try {
      const statusParam = statusFilter === "all" ? undefined : statusFilter;
      const assignParam =
        assignFilter === "mine" ? "me" :
        assignFilter === "unassigned" ? "unassigned" :
        undefined;
      const res = await api.listConversations(page, statusParam, assignParam);
      if (page === 1) setConversations(res);
      else setConversations(prev => [...prev, ...res]);
      setHasMoreConvs(res.length === 20);
    } catch (err) {
      if ((err as any)?.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function assignTo(userId: string | null) {
    if (!selected || assigning) return;
    setAssigning(true);
    try {
      const updated = await api.assignConversation(selected.id, userId);
      setSelected(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      setAssignMenuOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAssigning(false);
    }
  }

  function memberInitials(email?: string | null): string {
    if (!email) return "?";
    return email.slice(0, 2).toUpperCase();
  }

  async function changeStatus(newStatus: ConversationStatus) {
    if (!selected || updatingStatus || selected.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      const updated = await api.setConversationStatus(selected.id, newStatus);
      setSelected(updated);
      setConversations(prev => {
        // If filter would now exclude this conversation, remove it from list
        if (statusFilter !== "all" && updated.status !== statusFilter) {
          return prev.filter(c => c.id !== updated.id);
        }
        return prev.map(c => c.id === updated.id ? { ...c, ...updated } : c);
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
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
    setRating(null);
    api.getConversationRating(conv.id).then(r => setRating(r as any)).catch(() => setRating(null));
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

  function showTranscriptToast(msg: string, kind: "success" | "error" = "success") {
    setTranscriptToast({ msg, kind });
    setTimeout(() => setTranscriptToast(null), 3500);
  }

  async function handleExportDownload(format: "csv" | "pdf") {
    if (!selected) return;
    setExportMenuOpen(false);
    try {
      await api.downloadConversationExport(selected.id, format);
    } catch (err) {
      console.error(err);
      showTranscriptToast(`Failed to download ${format.toUpperCase()}`, "error");
    }
  }

  function openEmailTranscriptModal() {
    setExportMenuOpen(false);
    setEmailInput(selected?.visitor_email || "");
    setEmailModalOpen(true);
  }

  async function handleSendTranscriptEmail() {
    if (!selected || !emailInput.trim() || emailSending) return;
    setEmailSending(true);
    try {
      await api.emailConversationTranscript(selected.id, emailInput.trim());
      setEmailModalOpen(false);
      setEmailInput("");
      showTranscriptToast("Transcript queued for delivery");
    } catch (err) {
      console.error(err);
      showTranscriptToast("Failed to email transcript", "error");
    } finally {
      setEmailSending(false);
    }
  }

  async function handleSendAgent() {
    if (!selected || !agentInput.trim() || sendingAgent) return;
    setSendingAgent(true);
    try {
      const newMsg = composerMode === "note"
        ? await api.sendInternalNote(selected.id, agentInput)
        : await api.sendAgentReply(selected.id, agentInput);
      setAgentInput("");
      setMessages(prev => [...prev, newMsg]);
      if (composerMode !== "note") {
        setSelected((prev: any) => prev ? { ...prev, last_message_at: newMsg.created_at } : null);
      }
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
          <div className="p-4 space-y-3">
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
            <div className="flex items-center gap-2">
              <select
                value={assignFilter}
                onChange={e => setAssignFilter(e.target.value as typeof assignFilter)}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">All conversations</option>
                <option value="mine">My inbox</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer"
              >
                {FILTER_TABS.map(tab => (
                  <option key={tab.id} value={tab.id}>{tab.label === "All" ? "Any status" : tab.label}</option>
                ))}
              </select>
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
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{conv.message_count || 0} msg</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {conv.assigned_user_id && (
                        <span
                          title={`Assigned to ${conv.assigned_user_email || "member"}`}
                          className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-[8px] font-black flex items-center justify-center"
                        >
                          {memberInitials(conv.assigned_user_email)}
                        </span>
                      )}
                      <StatusPill status={conv.status} />
                    </span>
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
                      <StatusPill status={selected.status} />
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
                  <div className="relative">
                    <button
                      onClick={() => setAssignMenuOpen(o => !o)}
                      disabled={assigning}
                      title="Assign conversation"
                      className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-sm hover:border-violet-300 transition-colors disabled:opacity-60"
                    >
                      {selected.assigned_user_id ? (
                        <>
                          <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black flex items-center justify-center border border-violet-200">
                            {memberInitials(selected.assigned_user_email)}
                          </span>
                          <span className="max-w-[120px] truncate">{selected.assigned_user_email || "Member"}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>person_add</span>
                          <span>Assign</span>
                        </>
                      )}
                      <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>expand_more</span>
                    </button>
                    {assignMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAssignMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Assign to</div>
                          <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                            {currentUserId && (
                              <button
                                onClick={() => assignTo(currentUserId)}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                                Me
                              </button>
                            )}
                            {members.length === 0 && (
                              <div className="px-3 py-2 text-[11px] text-slate-400">No members</div>
                            )}
                            {members.map(m => (
                              <button
                                key={m.id}
                                onClick={() => assignTo(m.id)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center">
                                  {memberInitials(m.email)}
                                </span>
                                <span className="truncate flex-1">{m.email}</span>
                                {selected.assigned_user_id === m.id && (
                                  <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 16 }}>check</span>
                                )}
                              </button>
                            ))}
                          </div>
                          {selected.assigned_user_id && (
                            <button
                              onClick={() => assignTo(null)}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 border-t border-slate-100 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_off</span>
                              Unassign
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <select
                    value={selected.status || "open"}
                    onChange={e => changeStatus(e.target.value as ConversationStatus)}
                    disabled={updatingStatus}
                    title="Conversation status"
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-sm hover:border-violet-300 focus:border-violet-500 transition-colors disabled:opacity-60"
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
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
                  <div className="relative">
                    <button
                      onClick={() => setExportMenuOpen(v => !v)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-colors"
                      title="Export transcript"
                    >
                      <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                    {exportMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setExportMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-12 z-50 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                          <button
                            onClick={() => handleExportDownload("csv")}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left text-xs font-bold text-slate-700"
                          >
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>table_view</span>
                            Download as CSV
                          </button>
                          <button
                            onClick={() => handleExportDownload("pdf")}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left text-xs font-bold text-slate-700 border-t border-slate-50"
                          >
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>picture_as_pdf</span>
                            Download as PDF
                          </button>
                          <button
                            onClick={openEmailTranscriptModal}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left text-xs font-bold text-slate-700 border-t border-slate-50"
                          >
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 18 }}>mail</span>
                            Email transcript…
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
                      const isBot = msg.role === "assistant";
                      const isInternal = !!msg.is_internal;

                      if (isInternal) {
                        return (
                          <div key={msg.id || i} className="flex justify-center">
                            <div className="max-w-[80%] w-full bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 16 }}>lock</span>
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Internal note</span>
                                <span className="text-[10px] text-amber-500 ml-auto font-bold">Visible to agents only</span>
                              </div>
                              <div className="text-[13px] leading-relaxed text-amber-900 whitespace-pre-wrap">{msg.content}</div>
                              <span className="text-[10px] text-amber-400 mt-2 block font-bold uppercase tracking-wide">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      }

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
                <div className="max-w-4xl mx-auto space-y-3">
                  {/* Reply / Internal note toggle */}
                  <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setComposerMode("reply")}
                      className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                        composerMode === "reply"
                          ? "bg-white text-violet-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode("note")}
                      className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        composerMode === "note"
                          ? "bg-amber-400 text-amber-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                      Internal note
                    </button>
                  </div>
                  <div className="relative group">
                    <textarea
                      value={agentInput}
                      onChange={e => setAgentInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendAgent())}
                      placeholder={composerMode === "note"
                        ? "Leave a private note for other agents (not visible to the visitor)..."
                        : "Type your reply as a human agent..."}
                      className={`w-full border rounded-[2rem] px-6 py-5 text-sm outline-none transition-all resize-none min-h-[64px] max-h-32 shadow-inner pr-24 ${
                        composerMode === "note"
                          ? "bg-amber-50 border-amber-200 focus:border-amber-400 focus:bg-amber-50/70 placeholder:text-amber-700/60"
                          : "bg-slate-50 border-slate-200 focus:border-violet-500 focus:bg-white"
                      }`}
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
                       <div className={`flex items-center overflow-hidden rounded-2xl shadow-lg ${
                         composerMode === "note" ? "shadow-amber-200" : "shadow-violet-100"
                       }`}>
                          <button
                            onClick={handleSendAgent}
                            disabled={!agentInput.trim() || sendingAgent}
                            className={`text-white px-5 py-3 flex items-center justify-center transition-colors disabled:opacity-50 ${
                              composerMode === "note"
                                ? "bg-amber-500 hover:bg-amber-600 text-amber-950"
                                : "bg-violet-600 hover:bg-violet-700"
                            }`}
                            title={composerMode === "note" ? "Save internal note" : "Send reply"}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                              {composerMode === "note" ? "lock" : "send"}
                            </span>
                          </button>
                          <button className={`text-white px-2 py-3 flex items-center justify-center transition-colors border-l ${
                            composerMode === "note"
                              ? "bg-amber-500 hover:bg-amber-600 text-amber-950 border-amber-600/20"
                              : "bg-violet-600 hover:bg-violet-700 border-violet-500/20"
                          }`}>
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
            {rating && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 block">CSAT Rating</label>
                <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-500 text-lg leading-none">
                      {"★".repeat(rating.rating)}<span className="text-gray-300">{"★".repeat(5 - rating.rating)}</span>
                    </span>
                    <span className="text-[12px] font-black text-slate-800">{rating.rating}/5</span>
                  </div>
                  {rating.comment && (
                    <p className="text-[11px] text-slate-600 italic mt-1">&ldquo;{rating.comment}&rdquo;</p>
                  )}
                </div>
              </div>
            )}
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

      {emailModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Email transcript</h3>
                <p className="text-[11px] text-slate-400 mt-1">Send a PDF copy of this conversation to an email address.</p>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Recipient email</label>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="visitor@example.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 focus:bg-white transition-all placeholder:text-slate-400"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTranscriptEmail}
                disabled={!emailInput.trim() || emailSending}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-100 disabled:opacity-50"
              >
                {emailSending ? "Sending…" : "Send transcript"}
              </button>
            </div>
          </div>
        </div>
      )}

      {transcriptToast && (
        <div className={`fixed bottom-6 right-6 z-[70] px-5 py-3 rounded-2xl shadow-xl text-xs font-bold ${
          transcriptToast.kind === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {transcriptToast.msg}
        </div>
      )}

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
