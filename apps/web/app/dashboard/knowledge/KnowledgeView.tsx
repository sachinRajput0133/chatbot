"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

function getFileIcon(fileType: string): { icon: string; bg: string; color: string } {
  switch (fileType) {
    case "pdf":
      return { icon: "picture_as_pdf", bg: "bg-orange-100", color: "text-orange-600" };
    case "docx":
      return { icon: "description", bg: "bg-blue-100", color: "text-blue-600" };
    case "manual":
      return { icon: "sticky_note_2", bg: "bg-purple-100", color: "text-purple-600" };
    case "faq":
      return { icon: "quiz", bg: "bg-green-100", color: "text-green-600" };
    case "url":
      return { icon: "language", bg: "bg-cyan-100", color: "text-cyan-600" };
    default:
      return { icon: "description", bg: "bg-gray-100", color: "text-gray-600" };
  }
}

function StatusBadge({ status, progress }: { status: string; progress?: number }) {
  const map: Record<string, { text: string; dot: string; label: string }> = {
    indexed: { text: "text-emerald-600", dot: "bg-emerald-500", label: "Indexed" },
    processing: { text: "text-orange-600", dot: "bg-orange-500 animate-pulse", label: "Processing" },
    pending: { text: "text-yellow-600", dot: "bg-yellow-500 animate-pulse", label: "Pending" },
    failed: { text: "text-red-600", dot: "bg-red-500", label: "Failed" },
  };
  const s = map[status] ?? map.pending;
  if (status === "processing" && typeof progress === "number") {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
          {s.label}
        </span>
        <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] text-gray-500 font-medium">{progress}%</span>
      </div>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
      {s.label}
    </span>
  );
}

interface EditState {
  id: string;
  title: string;
  content: string;
  loading: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface KnowledgeViewProps {
  embedded?: boolean;
}

export default function KnowledgeView({ embedded = false }: KnowledgeViewProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [manual, setManual] = useState({ title: "", content: "" });
  const [faqItems, setFaqItems] = useState<FAQItem[]>([{ question: "", answer: "" }]);
  const [showURL, setShowURL] = useState(false);
  const [crawlURL, setCrawlURL] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [loadingContent, setLoadingContent] = useState<string | null>(null);

  async function loadDocs() {
    try {
      const d = await api.listDocuments();
      setDocs(d);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocs(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file);
      await loadDocs();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      await api.addManualKnowledge(manual);
      setManual({ title: "", content: "" });
      setShowManual(false);
      await loadDocs();
    } finally {
      setUploading(false);
    }
  }

  async function handleCrawlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!crawlURL.trim()) return;
    setUploading(true);
    try {
      await api.crawlURL(crawlURL.trim());
      setCrawlURL("");
      setShowURL(false);
      await loadDocs();
    } finally {
      setUploading(false);
    }
  }

  async function handleFAQSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = faqItems.filter((i) => i.question.trim() && i.answer.trim());
    if (!valid.length) return;
    setUploading(true);
    try {
      await api.addFAQKnowledge(valid);
      setFaqItems([{ question: "", answer: "" }]);
      setShowFAQ(false);
      await loadDocs();
    } finally {
      setUploading(false);
    }
  }

  function updateFAQItem(index: number, field: "question" | "answer", value: string) {
    setFaqItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addFAQRow() {
    setFaqItems((prev) => [...prev, { question: "", answer: "" }]);
  }

  function removeFAQRow(index: number) {
    setFaqItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function openEdit(doc: any) {
    setLoadingContent(doc.id);
    try {
      const data = await api.getDocumentContent(doc.id);
      setEditState({ id: doc.id, title: data.title, content: data.content, loading: false });
    } catch (e: any) {
      alert(e.message || "Failed to load content");
    } finally {
      setLoadingContent(null);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setEditState({ ...editState, loading: true });
    try {
      await api.updateManualDocument(editState.id, {
        title: editState.title,
        content: editState.content,
      });
      setEditState(null);
      await loadDocs();
    } catch (err: any) {
      alert(err.message || "Failed to save");
      setEditState({ ...editState, loading: false });
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    await api.deleteDocument(id);
    setDocs(docs.filter((d) => d.id !== id));
  }

  const totalChunks = docs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Edit modal */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Manual Text</h2>
              <button
                onClick={() => setEditState(null)}
                className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Title</label>
                <input
                  type="text"
                  required
                  value={editState.title}
                  onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Content</label>
                <textarea
                  required
                  rows={10}
                  value={editState.content}
                  onChange={(e) => setEditState({ ...editState, content: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editState.loading}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {editState.loading ? "Saving..." : "Save & Re-index"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditState(null)}
                  className="px-6 py-2.5 text-gray-500 text-sm font-bold hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* URL Crawl Modal */}
      {showURL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Train from URL</h2>
                <p className="text-xs text-gray-400 mt-0.5">We'll crawl the page and extract its content automatically.</p>
              </div>
              <button onClick={() => setShowURL(false)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
              </button>
            </div>
            <form onSubmit={handleCrawlSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Page URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://yourwebsite.com/about"
                  value={crawlURL}
                  onChange={(e) => setCrawlURL(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
                <p className="text-xs text-gray-400 mt-2">Single page crawl — paste your homepage, about page, pricing page, etc.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {uploading ? "Submitting..." : "Crawl & Index"}
                </button>
                <button type="button" onClick={() => setShowURL(false)} className="px-6 py-2.5 text-gray-500 text-sm font-bold hover:text-gray-900 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFAQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add FAQ</h2>
                <p className="text-xs text-gray-400 mt-0.5">Each Q&A pair is indexed separately for precise answers.</p>
              </div>
              <button onClick={() => setShowFAQ(false)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
              </button>
            </div>
            <form onSubmit={handleFAQSubmit} className="flex flex-col overflow-hidden">
              <div className="overflow-y-auto p-6 flex flex-col gap-4">
                {faqItems.map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Q&A #{i + 1}</span>
                      {faqItems.length > 1 && (
                        <button type="button" onClick={() => removeFAQRow(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Question"
                      value={item.question}
                      onChange={(e) => updateFAQItem(i, "question", e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    />
                    <textarea
                      required
                      rows={3}
                      placeholder="Answer"
                      value={item.answer}
                      onChange={(e) => updateFAQItem(i, "answer", e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFAQRow}
                  className="flex items-center gap-2 text-sm text-green-600 font-bold hover:text-green-700 transition-colors self-start"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
                  Add another Q&A
                </button>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {uploading ? "Saving..." : `Save ${faqItems.filter(i => i.question.trim()).length || ""} FAQ${faqItems.filter(i => i.question.trim()).length !== 1 ? "s" : ""}`}
                </button>
                <button type="button" onClick={() => setShowFAQ(false)} className="px-6 py-2.5 text-gray-500 text-sm font-bold hover:text-gray-900 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden file input (used by Upload File card) */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.docx"
        onChange={handleFileUpload}
        className="hidden"
        disabled={uploading}
      />

      {/* Page header */}
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-gray-900">Knowledge Base</h1>
              <span className="material-symbols-outlined text-violet-500" style={{ fontSize: "22px" }}>menu_book</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Upload and manage content sources to train your AI Agent.</p>
          </div>
          <button className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="material-symbols-outlined text-violet-500" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            How it works
          </button>
        </div>
      )}

      {/* KPI Row */}
      <KbKpis docs={docs} totalChunks={totalChunks} />

      {/* Add New Source */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-gray-900">Add New Source</h3>
        <p className="text-sm text-gray-500 mt-0.5 mb-3">Choose a method to add content to your knowledge base</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SourceTile
            icon="upload_file"
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            title="Upload File"
            desc="PDF, DOCX, TXT, CSV"
            onClick={() => fileRef.current?.click()}
            loading={uploading}
          />
          <SourceTile
            icon="public"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            title="Add Website URL"
            desc="Crawl and extract content"
            onClick={() => { setShowURL(true); setShowFAQ(false); setShowManual(false); }}
          />
          <SourceTile
            icon="quiz"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            title="Add FAQ"
            desc="Create Q&A pairs"
            onClick={() => { setShowFAQ(true); setShowManual(false); setShowURL(false); }}
          />
          <SourceTile
            icon="edit_note"
            iconBg="bg-orange-100"
            iconColor="text-orange-600"
            title="Add Text"
            desc="Paste or write content"
            onClick={() => { setShowManual(true); setShowFAQ(false); setShowURL(false); }}
            highlighted
          />
          <SourceTile
            icon="cloud_sync"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            title="Sync Integrations"
            desc="Drive, Notion, Confluence"
            onClick={() => router.push("/dashboard/integrations")}
          />
        </div>
      </div>

      {/* Indexed Sources + Right rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <IndexedSourcesTable
          docs={docs}
          loading={loading}
          loadingContent={loadingContent}
          onEdit={openEdit}
          onDelete={deleteDoc}
          onRefresh={loadDocs}
        />
        <aside className="space-y-4">
          <KbHealthCard docs={docs} />
          <SmartInsightsCard />
          <StorageCard docs={docs} />
        </aside>
      </div>
    </div>
  );
}

/* ───────────── Sub-components ───────────── */

function KbKpis({ docs, totalChunks }: { docs: any[]; totalChunks: number }) {
  const indexed = docs.filter((d) => d.status === "indexed").length;
  const accuracy = docs.length ? Math.round((indexed / docs.length) * 100) : 0;
  const lastUpdated = docs
    .map((d) => d.created_at ? new Date(d.created_at).getTime() : 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const lastUpdatedLabel = lastUpdated
    ? formatRelative(new Date(lastUpdated))
    : "—";
  const lastUpdatedAbs = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <KpiCard
        icon="description"
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
        label="Indexed Sources"
        value={String(indexed)}
        sub={`${docs.length} total · ${indexed === docs.length ? "all indexed" : `${docs.length - indexed} pending`}`}
        sparkColor="#8B5CF6"
      />
      <KpiCard
        icon="layers"
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
        label="Total Documents"
        value={String(docs.length)}
        sub={docs.length ? "across all sources" : "no documents yet"}
        sparkColor="#3B82F6"
      />
      <KpiCard
        icon="database"
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        label="Total Chunks"
        value={totalChunks.toLocaleString()}
        sub={totalChunks ? "embedded" : "—"}
        sparkColor="#10B981"
      />
      <KpiCard
        icon="trending_up"
        iconBg="bg-orange-50"
        iconColor="text-orange-600"
        label="Indexed Rate"
        value={docs.length ? `${accuracy}%` : "—"}
        sub={docs.length ? "of sources fully indexed" : "—"}
        sparkColor="#F97316"
      />
      <KpiCard
        icon="schedule"
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
        label="Last Updated"
        value={lastUpdatedLabel}
        sub={lastUpdatedAbs}
        sparkColor="#A855F7"
        showProgress
        progressValue={accuracy}
      />
    </section>
  );
}

function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  sparkColor,
  showProgress,
  progressValue,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  sparkColor: string;
  showProgress?: boolean;
  progressValue?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-4">
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: "20px" }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 font-medium truncate">{label}</div>
          <div className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</div>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 mb-2 truncate">{sub}</div>
      {showProgress ? (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(progressValue ?? 0, 6)}%`, backgroundColor: sparkColor }}
          />
        </div>
      ) : (
        <MiniSpark stroke={sparkColor} />
      )}
    </div>
  );
}

function MiniSpark({ stroke }: { stroke: string }) {
  const pts = [4, 6, 5, 8, 7, 9, 12];
  const w = 120;
  const h = 28;
  const max = Math.max(...pts);
  const step = w / (pts.length - 1);
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${h - (v / max) * (h - 4) - 2}`)
    .join(" ");
  const gid = `mini-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SourceTile({
  icon,
  iconBg,
  iconColor,
  title,
  desc,
  onClick,
  highlighted,
  loading,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  onClick: () => void;
  highlighted?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:opacity-60 ${
        highlighted
          ? "bg-orange-50/50 border-orange-200 hover:border-orange-300"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: "20px" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-semibold truncate ${highlighted ? "text-orange-700" : "text-gray-900"}`}>
          {loading && title === "Upload File" ? "Uploading..." : title}
        </div>
        <div className="text-[11px] text-gray-500 truncate">{desc}</div>
      </div>
    </button>
  );
}

function IndexedSourcesTable({
  docs,
  loading,
  loadingContent,
  onEdit,
  onDelete,
  onRefresh,
}: {
  docs: any[];
  loading: boolean;
  loadingContent: string | null;
  onEdit: (d: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = docs.filter((d) => {
    if (filterType !== "all" && d.file_type !== filterType) return false;
    if (search && !(d.filename ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">Indexed Sources</h2>
          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-semibold">
            {docs.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="bg-white border border-gray-200 rounded-lg text-xs font-medium px-3 py-2 outline-none text-gray-700"
          >
            <option value="all">All Sources</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="manual">Manual</option>
            <option value="faq">FAQ</option>
            <option value="url">Web Page</option>
          </select>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "16px" }}>search</span>
            <input
              type="text"
              placeholder="Search sources..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-transparent outline-none text-xs text-gray-700 placeholder:text-gray-400 w-40"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-gray-500" style={{ fontSize: "18px" }}>refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "28px" }}>folder_open</span>
          </div>
          <p className="text-gray-500 text-sm font-medium">{docs.length === 0 ? "No documents yet." : "No sources match your filters."}</p>
          {docs.length === 0 && <p className="text-gray-400 text-xs mt-1">Upload a file or add text to get started.</p>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                  <th className="text-left py-2.5 pr-4">Source Name</th>
                  <th className="text-left py-2.5 px-4">Type</th>
                  <th className="text-left py-2.5 px-4">Chunks</th>
                  <th className="text-left py-2.5 px-4">Status</th>
                  <th className="text-left py-2.5 px-4">Last Updated</th>
                  <th className="py-2.5 pl-4 w-8" />
                </tr>
              </thead>
              <tbody>
                {slice.map((doc) => {
                  const { icon, bg, color } = getFileIcon(doc.file_type);
                  const isManual = doc.file_type === "manual";
                  const isLoadingThis = loadingContent === doc.id;
                  const typeLabel = doc.file_type === "manual" ? "Text" : doc.file_type === "faq" ? "FAQ" : doc.file_type === "url" ? "Website" : doc.file_type?.toUpperCase();
                  return (
                    <tr key={doc.id} className="border-t border-gray-100 group hover:bg-gray-50/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
                            <span className="material-symbols-outlined" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate max-w-[260px]">{doc.filename}</div>
                            <div className="text-[11px] text-gray-500 truncate">{typeLabel} source</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-gray-600 uppercase">{typeLabel}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{(doc.chunk_count ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={doc.status} progress={doc.status === "processing" ? (doc.progress ?? 60) : undefined} />
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {doc.created_at ? (
                          <>
                            <div>{new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                            <div className="text-gray-400">{new Date(doc.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <RowActions
                          isManual={isManual}
                          isLoading={isLoadingThis}
                          onEdit={() => onEdit(doc)}
                          onDelete={() => onDelete(doc.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} sources
            </div>
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

function RowActions({
  isManual,
  isLoading,
  onEdit,
  onDelete,
}: {
  isManual: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>more_vert</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
          {isManual && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              disabled={isLoading}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>edit</span>
              Edit
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center gap-1">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_left</span>
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[28px] h-7 rounded-md text-xs font-semibold transition-colors ${
              p === page ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span>
      </button>
    </div>
  );
}

function KbHealthCard({ docs }: { docs: any[] }) {
  const indexed = docs.filter((d) => d.status === "indexed").length;
  const score = docs.length ? Math.round((indexed / docs.length) * 100) : 0;
  const items = [
    { label: "Sources Updated", ok: docs.length > 0 },
    { label: "Chunks Optimized", ok: indexed > 0 },
    { label: "AI Ready", ok: score >= 50 },
    { label: "No Issues Found", ok: docs.every((d) => d.status !== "failed") },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Knowledge Base Health</h3>
      <div className="flex items-center gap-4">
        <Donut value={score} />
        <ul className="space-y-1.5 flex-1">
          {items.map((it) => (
            <li key={it.label} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${it.ok ? "bg-emerald-500" : "bg-gray-300"}`} />
                <span className="text-gray-700">{it.label}</span>
              </div>
              <span className={`material-symbols-outlined ${it.ok ? "text-emerald-500" : "text-gray-300"}`} style={{ fontSize: "14px" }}>
                {it.ok ? "check_circle" : "radio_button_unchecked"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button className="mt-4 w-full py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors">
        View Health Report
      </button>
    </div>
  );
}

function Donut({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F1F2F4" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="#8B5CF6" strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-sm font-bold text-gray-900 leading-none">{value}%</div>
        <div className="text-[9px] text-gray-500 mt-0.5">Healthy</div>
      </div>
    </div>
  );
}

function SmartInsightsCard() {
  const items = [
    { icon: "lightbulb", iconBg: "bg-violet-100", iconColor: "text-violet-600", text: "Your bot answers are 24% more accurate with source content updated regularly." },
    { icon: "edit_note", iconBg: "bg-blue-100", iconColor: "text-blue-600", text: "Consider adding more FAQs about pricing and integrations." },
    { icon: "schedule", iconBg: "bg-orange-100", iconColor: "text-orange-600", text: "12 sources haven't been updated in over 30 days." },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Smart Insights</h3>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <div className={`w-7 h-7 ${it.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined ${it.iconColor}`} style={{ fontSize: "16px" }}>{it.icon}</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">{it.text}</p>
          </li>
        ))}
      </ul>
      <button className="mt-4 w-full py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors">
        View Insights
      </button>
    </div>
  );
}

function StorageCard({ docs }: { docs: any[] }) {
  // Approximate storage from chunks (no real usage tracked)
  const totalChunks = docs.reduce((s, d) => s + (d.chunk_count ?? 0), 0);
  const usedGB = +(totalChunks * 0.0004).toFixed(2);
  const limitGB = 10;
  const pct = Math.min(Math.round((usedGB / limitGB) * 100), 100);
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Storage Usage</h3>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
        <span>{usedGB} GB of {limitGB} GB used</span>
        <span className="font-semibold text-gray-900">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <button className="mt-4 w-full py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors">
        Manage Storage
      </button>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
