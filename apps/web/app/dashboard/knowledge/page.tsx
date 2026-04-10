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
    default:
      return { icon: "description", bg: "bg-gray-100", color: "text-gray-600" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    indexed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "indexed" },
    processing: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500 animate-pulse", label: "processing" },
    pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500 animate-pulse", label: "pending" },
    failed: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "failed" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function KnowledgePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ title: "", content: "" });

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

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    await api.deleteDocument(id);
    setDocs(docs.filter((d) => d.id !== id));
  }

  const totalChunks = docs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="p-10 max-w-6xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Hero Header */}
      <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="max-w-2xl">
          <h1 className="text-5xl font-extrabold tracking-tighter text-gray-900 leading-tight mb-4">
            Build your <span className="text-orange-600 italic">Brain.</span>
          </h1>
          <p className="text-lg text-gray-500 font-medium leading-relaxed">
            The Knowledge Base is the core of your AI's intelligence. Upload documents or add manual text to train your bot on your business data.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <label className={`flex items-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-2xl cursor-pointer hover:opacity-90 transition-all shadow-lg font-bold ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>upload_file</span>
            {uploading ? "Uploading..." : "Upload File"}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-2 px-6 py-4 bg-gray-200 text-gray-900 rounded-2xl hover:bg-gray-300 transition-all font-bold"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>edit_note</span>
            Add Text
          </button>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Stats card */}
        <div
          className="col-span-1 p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between text-white"
          style={{ backgroundColor: "#a93200" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-bold opacity-80 uppercase tracking-widest mb-2">Indexed Sources</p>
            <h3 className="text-4xl font-black mb-1">{docs.filter((d) => d.status === "indexed").length}</h3>
            <p className="text-xs opacity-70">{totalChunks.toLocaleString()} total chunks indexed</p>
          </div>
          <div className="mt-8 relative z-10 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-white rounded-full transition-all"
              style={{ width: docs.length ? `${Math.min((docs.filter((d) => d.status === "indexed").length / docs.length) * 100, 100)}%` : "0%" }}
            />
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: "160px", fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
          </div>
        </div>

        {/* Manual text / Add text card */}
        <div className="col-span-2 bg-gray-50 p-8 rounded-[2rem] relative overflow-hidden">
          {showManual ? (
            <form onSubmit={handleManual} className="h-full flex flex-col gap-4">
              <h4 className="text-2xl font-bold">Add Text Knowledge</h4>
              <input
                type="text"
                required
                placeholder="Title (e.g. 'Business Hours')"
                value={manual.title}
                onChange={(e) => setManual({ ...manual, title: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <textarea
                required
                rows={4}
                placeholder="Paste your FAQ, pricing, or business information..."
                value={manual.content}
                onChange={(e) => setManual({ ...manual, content: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-60"
                >
                  {uploading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="px-6 py-2.5 text-gray-500 text-sm font-bold hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col justify-between h-full">
              <div>
                <h4 className="text-2xl font-bold mb-2">Add Manual Text</h4>
                <p className="text-gray-500 text-sm mb-6 max-w-sm">
                  Add FAQs, business hours, product info, or any custom text to train your bot.
                </p>
              </div>
              <button
                onClick={() => setShowManual(true)}
                className="self-start flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
                Write Text
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Indexed Sources Table */}
      <div className="bg-white rounded-[2rem] p-10" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-extrabold tracking-tight">Indexed Sources</h2>
          <div className="flex gap-2">
            <button
              onClick={loadDocs}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "22px" }}>refresh</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-sm font-bold py-8 text-center">Loading...</div>
        ) : docs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "32px" }}>folder_open</span>
            </div>
            <p className="text-gray-400 font-medium">No documents yet.</p>
            <p className="text-gray-300 text-sm mt-1">Upload a file or add text to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const { icon, bg, color } = getFileIcon(doc.file_type);
              return (
                <div
                  key={doc.id}
                  className="grid grid-cols-12 gap-4 p-6 rounded-2xl items-center hover:bg-gray-50 transition-colors group"
                >
                  {/* Name + icon */}
                  <div className="col-span-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>
                        {icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{doc.filename}</h4>
                      <p className="text-xs text-gray-400">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        {" · "}
                        {doc.file_type === "manual" ? "Manual Input" : doc.file_type?.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-3">
                    <StatusBadge status={doc.status} />
                  </div>

                  {/* Chunks */}
                  <div className="col-span-2 text-sm font-semibold text-gray-400">
                    {doc.chunk_count ? `${doc.chunk_count.toLocaleString()} chunks` : "—"}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
