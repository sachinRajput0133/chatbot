"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useListAuditLogsQuery } from "@/lib/api";
import { useIsOwner } from "@/lib/hooks/useCan";

const PAGE_SIZE = 50;

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTarget(targetType: string | null, targetId: string | null): string {
  if (!targetType && !targetId) return "—";
  if (targetType && targetId) return `${targetType}:${targetId.slice(0, 8)}`;
  return targetType || targetId || "—";
}

export default function AuditLogPage() {
  const router = useRouter();
  const isOwner = useIsOwner();
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading, error } = useListAuditLogsQuery({
    limit: PAGE_SIZE,
    offset,
    action: actionFilter || undefined,
  });

  if (!isOwner) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-gray-900">Owner-only</h1>
        <p className="text-sm text-gray-500 mt-2">Only the workspace owner can view audit logs.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record of every state-changing admin action in your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by action (e.g. member.invite)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-72 bg-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Actor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Target</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-red-600">
                    Failed to load audit logs.
                  </td>
                </tr>
              )}
              {!isLoading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No audit events yet.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.actor_email ?? <span className="text-gray-400">system</span>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px]">
                      {row.action}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-[12px]">
                    {formatTarget(row.target_type, row.target_id)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-[12px]">
                    {row.ip_address ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600">
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
