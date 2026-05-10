"use client";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

const OWNER_SENTINEL = "*:*";

/**
 * Permission helper. Returns true when the current user has the given
 * (module, action). Owners (sentinel "*:*" or role === "owner") always pass.
 *
 *   const canEdit = useCan("knowledge", "edit");
 */
export function useCan(module: string, action: string): boolean {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user) return false;
  if (user.role === "owner") return true;
  const perms = user.permissions ?? [];
  if (perms.includes(OWNER_SENTINEL)) return true;
  return perms.includes(`${module}:${action}`);
}

/** Returns the list of permissions, or null when unauthenticated. */
export function usePermissions(): string[] | null {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user) return null;
  if (user.role === "owner") return [OWNER_SENTINEL];
  return user.permissions ?? [];
}

export function useIsOwner(): boolean {
  const user = useSelector((s: RootState) => s.auth.user);
  return user?.role === "owner";
}
