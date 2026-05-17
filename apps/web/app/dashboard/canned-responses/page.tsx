"use client";
import { useState } from "react";
import {
  useListCannedResponsesQuery,
  useCreateCannedResponseMutation,
  useUpdateCannedResponseMutation,
  useDeleteCannedResponseMutation,
  type CannedResponseOut,
} from "@/lib/api";
import { useCan } from "@/lib/hooks/useCan";

function preview(text: string, n = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

interface EditorState {
  id: string | null;
  shortcut: string;
  title: string;
  content: string;
}

const EMPTY_EDITOR: EditorState = { id: null, shortcut: "", title: "", content: "" };

export default function CannedResponsesPage() {
  const canEdit = useCan("conversations", "edit");
  const { data, isLoading, error } = useListCannedResponsesQuery();
  const [createCr, { isLoading: creating }] = useCreateCannedResponseMutation();
  const [updateCr, { isLoading: updating }] = useUpdateCannedResponseMutation();
  const [deleteCr] = useDeleteCannedResponseMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditor(EMPTY_EDITOR);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: CannedResponseOut) {
    setEditor({ id: row.id, shortcut: row.shortcut, title: row.title, content: row.content });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    const shortcut = editor.shortcut.trim().replace(/^\/+/, "").toLowerCase();
    const title = editor.title.trim();
    const content = editor.content;
    if (!shortcut || !title || !content.trim()) {
      setFormError("All fields are required.");
      return;
    }
    try {
      if (editor.id) {
        await updateCr({ id: editor.id, patch: { shortcut, title, content } }).unwrap();
      } else {
        await createCr({ shortcut, title, content }).unwrap();
      }
      setModalOpen(false);
      setEditor(EMPTY_EDITOR);
    } catch (e: any) {
      setFormError(e?.data?.detail ?? "Failed to save.");
    }
  }

  async function handleDelete(row: CannedResponseOut) {
    if (!confirm(`Delete shortcut "/${row.shortcut}"?`)) return;
    try {
      await deleteCr(row.id).unwrap();
    } catch {
      // ignore
    }
  }

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canned Responses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quick-reply templates agents can insert by typing <code className="px-1 py-0.5 rounded bg-gray-100 text-[12px]">/shortcut</code> in the conversation composer.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F15A24] hover:bg-[#D94918] text-white font-semibold text-[13px] shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            Add new
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Shortcut</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Content</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              )}
              {error && !isLoading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-red-600">Failed to load.</td></tr>
              )}
              {!isLoading && !error && items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No canned responses yet.</td></tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px]">/{row.shortcut}</code>
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{row.title}</td>
                  <td className="px-4 py-3 text-gray-600">{preview(row.content)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editor.id ? "Edit canned response" : "New canned response"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-900">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shortcut</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono">/</span>
                  <input
                    type="text"
                    value={editor.shortcut}
                    onChange={(e) => setEditor({ ...editor, shortcut: e.target.value })}
                    placeholder="refund"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Lowercase letters, digits, dashes. No spaces.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder="Refund policy"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Content</label>
                <textarea
                  value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  rows={6}
                  placeholder="Hi! Our refund policy allows…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30 resize-y"
                />
              </div>
              {formError && (
                <div className="text-sm text-red-600">{formError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={creating || updating}
                className="px-4 py-2 rounded-lg bg-[#F15A24] hover:bg-[#D94918] text-white text-sm font-semibold disabled:opacity-50"
              >
                {editor.id ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
