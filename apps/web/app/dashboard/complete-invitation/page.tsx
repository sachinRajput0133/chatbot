"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useCompleteInvitationMutation, authApi } from "@/lib/api";
import { patchUser, setAuth } from "@/lib/slices/authSlice";
import { store, type RootState } from "@/lib/store";

export default function CompleteInvitationPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const token = useSelector((s: RootState) => s.auth.token);
  const [completeInvitation, { isLoading }] = useCompleteInvitationMutation();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // If a logged-in user that doesn't need a password reset somehow lands here, kick them out.
  if (user && user.must_change_password === false) {
    router.replace("/dashboard");
    return null;
  }
  if (!user || !token) {
    router.replace("/login");
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await completeInvitation({ new_password: pw }).unwrap();
      // Refresh auth state from server to clear must_change_password and reload permissions.
      const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(
        setAuth({
          token: token!,
          user: {
            id: me.user.id,
            email: me.user.email,
            role: me.user.role,
            tenant_id: me.user.tenant_id,
            is_google_user: me.user.is_google_user,
            role_id: me.user.role_id ?? null,
            role_name: me.user.role_name ?? null,
            must_change_password: false,
            permissions: me.user.permissions ?? [],
          },
        })
      );
      dispatch(patchUser({ must_change_password: false }));
      router.replace("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Failed to set password. Please try again.");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-rose-50 px-6"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white shadow-lg mb-4">
            <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>lock_reset</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Set Your Password</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Welcome to <span className="font-bold text-gray-900">ChatBot AI</span>. To finish setting up your account
            <span className="block">({user.email}), choose a new password.</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">Confirm Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                confirm && confirm !== pw ? "border-red-300" : "border-gray-200"
              }`}
            />
            {confirm && confirm !== pw && (
              <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !pw || pw !== confirm}
            className="w-full py-3.5 rounded-xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-orange-300/40"
            style={{
              backgroundImage: "linear-gradient(95deg, #f97316 0%, #ec4899 100%)",
            }}
          >
            {isLoading ? "Saving…" : "Continue to Dashboard"}
            {!isLoading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400">
          Once set, you&apos;ll use this password every time you sign in.
        </p>
      </div>
    </div>
  );
}
