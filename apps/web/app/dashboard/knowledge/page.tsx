"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  indexed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function KnowledgePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ title: "", content: "" });

  async function loadDocs() {
    try {
      const d = await api.listDocuments();
      setDocs(d);
    } catch { router.push("/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDocs(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file);
      await loadDocs();
    } finally { setUploading(false); }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      await api.addManualKnowledge(manual);
      setManual({ title: "", content: "" });
      setShowManual(false);
      await loadDocs();
    } finally { setUploading(false); }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    await api.deleteDocument(id);
    setDocs(docs.filter((d) => d.id !== id));
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-1">Upload documents to train your chatbot</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(!showManual)}
            className="border border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition"
          >
            Add Text
          </button>
          <label className={`bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700 transition ${uploading ? "opacity-60" : ""}`}>
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" accept=".pdf,.txt,.docx" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Manual text form */}
      {showManual && (
        <form onSubmit={handleManual} className="bg-white border rounded-xl p-5 mb-5">
          <h3 className="font-semibold mb-3">Add Text Knowledge</h3>
          <input
            type="text"
            required
            placeholder="Title (e.g. 'Business Hours')"
            value={manual.title}
            onChange={(e) => setManual({ ...manual, title: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            required
            rows={4}
            placeholder="Paste your FAQ, pricing, business information..."
            value={manual.content}
            onChange={(e) => setManual({ ...manual, content: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={uploading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setShowManual(false)} className="text-gray-400 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📄</div>
          <p>No documents yet. Upload a file or add text to get started.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {docs.map((doc, i) => (
            <div key={doc.id} className={`flex items-center justify-between p-4 ${i < docs.length - 1 ? "border-b" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{doc.file_type === "pdf" ? "📕" : doc.file_type === "docx" ? "📘" : "📄"}</span>
                <div>
                  <div className="font-medium text-sm">{doc.filename}</div>
                  <div className="text-xs text-gray-400">{doc.chunk_count} chunks · {new Date(doc.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[doc.status]}`}>
                  {doc.status}
                </span>
                <button onClick={() => deleteDoc(doc.id)} className="text-gray-300 hover:text-red-500 transition text-lg">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
