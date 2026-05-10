"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useListUsersQuery,
  useInviteUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useListRolesQuery,
  type UserAdminOut,
  type RoleOut,
} from "@/lib/api";
import { useIsOwner } from "@/lib/hooks/useCan";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function MembersPage() {
  const router = useRouter();
  const isOwner = useIsOwner();
  const { data: users, isLoading: usersLoading, error: usersError } = useListUsersQuery();
  const { data: roles } = useListRolesQuery();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<UserAdminOut | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserAdminOut | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Non-owners shouldn't see this page at all (defense in depth — sidebar already hides it).
  if (!isOwner) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-gray-900">Owner-only</h1>
        <p className="text-sm text-gray-500 mt-2">Only the workspace owner can manage members.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-6 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-1">Invite teammates and assign their roles</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          disabled={!roles || roles.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_add</span>
          Invite Member
        </button>
      </div>

      {toast && (
        <div
          className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
            toast.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          {toast.text}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {usersLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : usersError ? (
          <div className="p-12 text-center text-sm text-red-600">Failed to load members.</div>
        ) : !users || users.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500" style={{ fontSize: "32px" }}>group</span>
            </div>
            <p className="text-gray-700 font-bold">No members yet</p>
            <p className="text-sm text-gray-500 mt-1">Invite your first teammate to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th className="text-right pr-6">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{u.email}</div>
                          {u.must_change_password && (
                            <div className="text-[11px] text-amber-600 font-bold mt-0.5">Pending password reset</div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {u.role === "owner" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold uppercase tracking-wide">
                          Owner
                        </span>
                      ) : (
                        <span className="text-gray-700 font-medium">{u.role_name ?? "—"}</span>
                      )}
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          u.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </Td>
                    <Td className="text-gray-500">{formatDate(u.created_at)}</Td>
                    <Td className="text-right pr-6">
                      {u.role === "owner" ? (
                        <span className="text-xs text-gray-400 italic">—</span>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setEditing(u)}
                            className="p-2 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(u)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                          </button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(!roles || roles.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          You haven&apos;t created any custom roles yet. Visit{" "}
          <button onClick={() => router.push("/dashboard/roles")} className="underline font-bold">
            Roles &amp; Permissions
          </button>{" "}
          to create one before inviting members.
        </div>
      )}

      {inviteOpen && roles && roles.length > 0 && (
        <InviteModal
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onSuccess={(text) => {
            setToast({ type: "success", text });
            setInviteOpen(false);
          }}
          onError={(text) => setToast({ type: "error", text })}
        />
      )}
      {editing && roles && (
        <EditMemberModal
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSuccess={(text) => {
            setToast({ type: "success", text });
            setEditing(null);
          }}
          onError={(text) => setToast({ type: "error", text })}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          user={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onSuccess={(text) => {
            setToast({ type: "success", text });
            setConfirmDelete(null);
          }}
          onError={(text) => setToast({ type: "error", text })}
        />
      )}
    </div>
  );
}

/* ───────── modals ───────── */

function InviteModal({
  roles,
  onClose,
  onSuccess,
  onError,
}: {
  roles: RoleOut[];
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [invite, { isLoading }] = useInviteUserMutation();
  const assignableRoles = roles.filter((r) => !r.is_system || r.name.toLowerCase() !== "owner");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(assignableRoles[0]?.id ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await invite({ email, role_id: roleId }).unwrap();
      const text = res.invitation_email_sent
        ? `Invitation sent to ${email}`
        : `Member added: ${email} (no email service configured — share the temp password manually)`;
      onSuccess(text);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      onError(detail || "Failed to invite member.");
    }
  }

  return (
    <Modal onClose={onClose} title="Invite Member">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1.5">Role</label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.is_system ? " (system)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1.5">
            They&apos;ll receive an email with a temporary password and be required to change it on first login.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !roleId}
            className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-60"
          >
            {isLoading ? "Sending…" : "Send Invitation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({
  user,
  roles,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserAdminOut;
  roles: RoleOut[];
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const assignableRoles = roles.filter((r) => !r.is_system || r.name.toLowerCase() !== "owner");
  const [roleId, setRoleId] = useState(user.role_id ?? "");
  const [isActive, setIsActive] = useState(user.is_active);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateUser({
        id: user.id,
        data: {
          role_id: roleId !== user.role_id ? roleId : undefined,
          is_active: isActive !== user.is_active ? isActive : undefined,
        },
      }).unwrap();
      onSuccess("Member updated.");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      onError(detail || "Failed to update member.");
    }
  }

  return (
    <Modal onClose={onClose} title="Edit Member">
      <form onSubmit={submit} className="space-y-5">
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="text-gray-500">Email:</span>{" "}
          <span className="font-bold text-gray-900">{user.email}</span>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1.5">Role</label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.is_system ? " (system)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="font-bold text-gray-900 text-sm">Account active</p>
            <p className="text-xs text-gray-500 mt-0.5">Disabled accounts cannot sign in.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? "bg-orange-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-60">
            {isLoading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserAdminOut;
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [deleteUser, { isLoading }] = useDeleteUserMutation();

  async function confirm() {
    try {
      await deleteUser(user.id).unwrap();
      onSuccess(`${user.email} removed.`);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      onError(detail || "Failed to remove member.");
    }
  }

  return (
    <Modal onClose={onClose} title="Remove Member">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Are you sure you want to remove{" "}
          <span className="font-bold text-gray-900">{user.email}</span>? They will lose access to this workspace immediately.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
          >
            {isLoading ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── primitives ───────── */

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-6 py-3.5 ${className}`}>{children}</td>;
}
