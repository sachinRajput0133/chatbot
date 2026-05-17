"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsOwner } from "@/lib/hooks/useCan";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type DeleteMode = "anonymize" | "hard_delete";

type DeleteResponse = {
  mode: DeleteMode;
  conversations_affected: number;
  messages_affected: number;
};

type ExportResponse = {
  counts: { conversations: number; messages: number };
  [k: string]: unknown;
};

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("cb_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function GdprPage() {
  const router = useRouter();
  const isOwner = useIsOwner();

  const [visitorId, setVisitorId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"export" | "anonymize" | "hard_delete" | null>(null);
  const [result, setResult] = useState<{
    kind: "export" | "delete";
    counts: { conversations: number; messages: number };
    mode?: DeleteMode;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<DeleteMode | null>(null);
  const [confirmText, setConfirmText] = useState("");

  if (!isOwner) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-gray-900">Owner-only</h1>
        <p className="text-sm text-gray-500 mt-2">Only the workspace owner can access data privacy tools.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  function buildQuery(): string | null {
    const params = new URLSearchParams();
    const vid = visitorId.trim();
    const em = email.trim();
    if (!vid && !em) {
      setError("Enter a visitor ID or an email.");
      return null;
    }
    if (vid) params.set("visitor_id", vid);
    if (em) params.set("email", em);
    return params.toString();
  }

  async function handleExport() {
    setError(null);
    setResult(null);
    const qs = buildQuery();
    if (!qs) return;
    setBusy("export");
    try {
      const res = await fetch(`${API_URL}/api/gdpr/export?${qs}`, {
        headers: { ...authHeader() },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ExportResponse;
      // Trigger a JSON download.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const tag = visitorId.trim() || email.trim() || "visitor";
      a.href = url;
      a.download = `gdpr-export-${tag}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setResult({ kind: "export", counts: data.counts });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function runDelete(mode: DeleteMode) {
    setError(null);
    setResult(null);
    setBusy(mode);
    try {
      const body: Record<string, string> = { mode };
      if (visitorId.trim()) body.visitor_id = visitorId.trim();
      if (email.trim()) body.email = email.trim();
      const res = await fetch(`${API_URL}/api/gdpr/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DeleteResponse;
      setResult({
        kind: "delete",
        counts: { conversations: data.conversations_affected, messages: data.messages_affected },
        mode: data.mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(null);
      setConfirmMode(null);
      setConfirmText("");
    }
  }

  function openConfirm(mode: DeleteMode) {
    setError(null);
    if (!visitorId.trim() && !email.trim()) {
      setError("Enter a visitor ID or an email.");
      return;
    }
    setConfirmMode(mode);
    setConfirmText("");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Privacy</h1>
        <p className="text-sm text-gray-500 mt-1">
          GDPR data subject access requests. Export or erase all personal data for a single visitor.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Visitor ID
            </label>
            <input
              type="text"
              value={visitorId}
              onChange={(e) => setVisitorId(e.target.value)}
              placeholder="e.g. v_abc123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Or Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="visitor@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Provide either a visitor ID or an email (or both). All actions are scoped to your workspace only.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExport}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              download
            </span>
            {busy === "export" ? "Exporting..." : "Preview / Export JSON"}
          </button>
          <button
            onClick={() => openConfirm("anonymize")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              visibility_off
            </span>
            Anonymize
          </button>
          <button
            onClick={() => openConfirm("hard_delete")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              delete_forever
            </span>
            Hard Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 space-y-1">
          {result.kind === "export" ? (
            <div className="font-semibold">Export downloaded.</div>
          ) : (
            <div className="font-semibold">
              {result.mode === "anonymize" ? "Anonymization complete." : "Hard delete complete."}
            </div>
          )}
          <div>Conversations affected: {result.counts.conversations}</div>
          <div>Messages affected: {result.counts.messages}</div>
        </div>
      )}

      {confirmMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600" style={{ fontSize: "20px" }}>
                  warning
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {confirmMode === "anonymize" ? "Anonymize visitor data?" : "Hard delete visitor data?"}
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  {confirmMode === "anonymize"
                    ? "PII fields will be redacted. Conversation rows are preserved (for analytics) but no longer identify the visitor."
                    : "All matching conversation rows and their messages will be permanently deleted. This cannot be undone."}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Type <span className="text-red-600">DELETE</span> to confirm
              </label>
              <input
                autoFocus
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setConfirmMode(null);
                  setConfirmText("");
                }}
                disabled={busy !== null}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => runDelete(confirmMode)}
                disabled={busy !== null || confirmText !== "DELETE"}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {busy === confirmMode
                  ? "Working..."
                  : confirmMode === "anonymize"
                  ? "Anonymize"
                  : "Hard Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
