"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useListRolesQuery,
  useGetPermissionRegistryQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  type RoleOut,
  type PermissionEntry,
} from "@/lib/api";
import { useIsOwner } from "@/lib/hooks/useCan";

const MODULE_LABELS: Record<string, string> = {
  knowledge: "Knowledge Base",
  customize: "Customize Bot",
  lead_capture: "Lead Capture",
  goals: "Bot Goals",
  embed: "Embed Code",
  developer: "Developer API",
  conversations: "Conversations",
  analytics: "Analytics",
  integrations: "Integrations",
  billing: "Billing",
  users: "Members",
  roles: "Roles",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  manage: "Manage",
};

export default function RolesPage() {
  const router = useRouter();
  const isOwner = useIsOwner();
  const { data: roles, isLoading: rolesLoading } = useListRolesQuery();
  const { data: registry, isLoading: regLoading } = useGetPermissionRegistryQuery();

  const [editing, setEditing] = useState<RoleOut | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoleOut | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOwner) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-gray-900">Owner-only</h1>
        <p className="text-sm text-gray-500 mt-2">Only the workspace owner can manage roles.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-6 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isLoading = rolesLoading || regLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define custom roles and assign granular permissions to your team.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={!registry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          New Role
        </button>
      </div>

      {toast && (
        <div className={`text-sm p-3 rounded-lg flex items-center gap-2 ${toast.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          {toast.text}
        </div>
      )}

      {isLoading ? (
        <div className="p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(roles ?? []).map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              onEdit={() => setEditing(r)}
              onDelete={() => setConfirmDelete(r)}
            />
          ))}
        </div>
      )}

      {editing && registry && (
        <RoleEditorModal
          role={editing === "new" ? null : editing}
          registry={registry.modules}
          onClose={() => setEditing(null)}
          onSuccess={(text) => {
            setToast({ type: "success", text });
            setEditing(null);
          }}
          onError={(text) => setToast({ type: "error", text })}
        />
      )}
      {confirmDelete && (
        <DeleteRoleConfirm
          role={confirmDelete}
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

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: RoleOut;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const moduleCount = useMemo(() => {
    const mods = new Set(role.permissions.map((p) => p.module));
    return mods.size;
  }, [role.permissions]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate">{role.name}</h3>
            {role.is_system && (
              <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wide">
                System
              </span>
            )}
          </div>
          {role.description && <p className="text-xs text-gray-500 leading-relaxed">{role.description}</p>}
        </div>
        {!role.is_system && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50" title="Edit">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
            </button>
            <button
              onClick={onDelete}
              disabled={role.user_count > 0}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
              title={role.user_count > 0 ? "Reassign members before deleting" : "Delete"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "14px" }}>group</span>
          {role.user_count} {role.user_count === 1 ? "member" : "members"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "14px" }}>key</span>
          {role.permissions.length} {role.permissions.length === 1 ? "permission" : "permissions"} · {moduleCount} modules
        </span>
      </div>

      {role.is_system && (
        <button
          onClick={onEdit}
          className="mt-4 text-xs font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
        >
          View permissions
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
        </button>
      )}
    </div>
  );
}

/* ───────── editor ───────── */

function RoleEditorModal({
  role,
  registry,
  onClose,
  onSuccess,
  onError,
}: {
  role: RoleOut | null;
  registry: Record<string, string[]>;
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const isNew = role === null;
  const isReadOnly = !isNew && role.is_system;
  const [createRole, { isLoading: creating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");

  const initialSet = useMemo(() => {
    const set = new Set<string>();
    role?.permissions.forEach((p) => set.add(`${p.module}:${p.action}`));
    return set;
  }, [role]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSet));

  function toggle(module: string, action: string) {
    if (isReadOnly) return;
    const key = `${module}:${action}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function toggleModuleAll(module: string, actions: string[]) {
    if (isReadOnly) return;
    const next = new Set(selected);
    const allSelected = actions.every((a) => next.has(`${module}:${a}`));
    if (allSelected) {
      actions.forEach((a) => next.delete(`${module}:${a}`));
    } else {
      actions.forEach((a) => next.add(`${module}:${a}`));
    }
    setSelected(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    const permissions: PermissionEntry[] = Array.from(selected).map((k) => {
      const [m, a] = k.split(":");
      return { module: m, action: a };
    });
    try {
      if (isNew) {
        await createRole({
          name: name.trim(),
          description: description.trim() || null,
          permissions,
        }).unwrap();
        onSuccess(`Role "${name}" created.`);
      } else {
        await updateRole({
          id: role.id,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            permissions,
          },
        }).unwrap();
        onSuccess(`Role "${name}" updated.`);
      }
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      onError(detail || "Failed to save role.");
    }
  }

  const modules = Object.entries(registry).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isNew ? "Create Role" : isReadOnly ? `${role.name} (System Role)` : `Edit ${role.name}`}
            </h2>
            {isReadOnly && (
              <p className="text-xs text-gray-500 mt-0.5">System roles are read-only.</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name + description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Role Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. Support Agent"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Description</label>
              <input
                type="text"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isReadOnly}
                placeholder="What does this role do?"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Permissions matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-gray-900">Permissions</label>
              <span className="text-xs text-gray-500">
                {selected.size} of {modules.reduce((s, [, a]) => s + a.length, 0)} selected
              </span>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {modules.map(([module, actions]) => {
                const allSelected = actions.every((a) => selected.has(`${module}:${a}`));
                const someSelected = actions.some((a) => selected.has(`${module}:${a}`));
                return (
                  <div key={module} className="px-4 py-3 hover:bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <button
                        type="button"
                        onClick={() => toggleModuleAll(module, actions)}
                        disabled={isReadOnly}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} />
                        <span className="font-bold text-sm text-gray-900">{MODULE_LABELS[module] ?? module}</span>
                      </button>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{module}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-7">
                      {[...actions].sort().map((action) => {
                        const key = `${module}:${action}`;
                        const checked = selected.has(key);
                        return (
                          <button
                            type="button"
                            key={action}
                            onClick={() => toggle(module, action)}
                            disabled={isReadOnly}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                              checked
                                ? "bg-orange-50 border-orange-300 text-orange-700"
                                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                            } ${isReadOnly ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <Checkbox checked={checked} small />
                            {ACTION_LABELS[action] ?? action}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            {isReadOnly ? "Close" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button
              onClick={submit}
              disabled={creating || updating || !name.trim()}
              className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-60"
            >
              {creating || updating ? "Saving…" : isNew ? "Create Role" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteRoleConfirm({
  role,
  onClose,
  onSuccess,
  onError,
}: {
  role: RoleOut;
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [deleteRole, { isLoading }] = useDeleteRoleMutation();

  async function confirm() {
    try {
      await deleteRole(role.id).unwrap();
      onSuccess(`Role "${role.name}" deleted.`);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      onError(detail || "Failed to delete role.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Delete Role</h2>
        <p className="text-sm text-gray-700">
          Delete role <span className="font-bold">{role.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
          >
            {isLoading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate = false,
  small = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  small?: boolean;
}) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  const iconSize = small ? 11 : 13;
  return (
    <span
      className={`${size} rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked || indeterminate
          ? "bg-orange-500 border-orange-500"
          : "border-gray-300"
      }`}
    >
      {indeterminate && !checked ? (
        <span className="block w-1.5 h-0.5 bg-white rounded-full" />
      ) : checked ? (
        <span className="material-symbols-outlined text-white" style={{ fontSize: `${iconSize}px` }}>check</span>
      ) : null}
    </span>
  );
}
