"use client";
import { useState } from "react";
import {
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from "@/lib/api";

// Country list (ISO 3166-1 alpha-2, most common first)
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "NL", name: "Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "PK", name: "Pakistan" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
];

const PLAN_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-gray-100 text-gray-600" },
  starter: { label: "Starter", color: "bg-blue-100 text-blue-700" },
  growth: { label: "Growth", color: "bg-indigo-100 text-indigo-700" },
  enterprise: { label: "Enterprise", color: "bg-purple-100 text-purple-700" },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const { data, isLoading, refetch } = useMeQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changingPw }] = useChangePasswordMutation();

  // Profile form state
  const [profileForm, setProfileForm] = useState<{ business_name: string; country: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form state
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) return null;

  const { user, tenant } = data;
  const planBadge = PLAN_BADGES[tenant.plan] ?? PLAN_BADGES.free;
  const isGoogleUser = user.is_google_user;

  // Initialize profile form from server data
  const pf = profileForm ?? { business_name: tenant.business_name, country: tenant.country };

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await updateProfile({
        business_name: pf.business_name,
        country: pf.country,
      }).unwrap();
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
      setProfileForm(null); // reset to server truth
      refetch();
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setProfileMsg({ type: "error", text: detail ?? "Failed to update profile." });
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    try {
      await changePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      }).unwrap();
      setPwMsg({ type: "success", text: "Password changed successfully!" });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setPwMsg({ type: "error", text: detail ?? "Failed to change password." });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account details and security settings</p>
      </div>

      {/* Account Overview Card */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-4 mb-6">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{tenant.business_name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planBadge.color}`}>
                {planBadge.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">Member since {formatDate(tenant.created_at)}</span>
              {isGoogleUser && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google account
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-100">
          {[
            { label: "Email", value: user.email },
            { label: "Role", value: user.role.charAt(0).toUpperCase() + user.role.slice(1) },
            { label: "Country", value: COUNTRIES.find((c) => c.code === tenant.country)?.name ?? tenant.country },
            { label: "Messages This Month", value: tenant.message_count_month.toLocaleString() },
            { label: "Account ID", value: user.id.slice(0, 8) + "…" },
            { label: "Bot ID", value: tenant.bot_id.slice(0, 8) + "…" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{item.label}</span>
              <span className="text-sm text-gray-800 font-medium mt-0.5">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Business Details */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🏢</span>
          <div>
            <h3 className="font-semibold text-gray-900">Business Details</h3>
            <p className="text-xs text-gray-500">Update your business name and country</p>
          </div>
        </div>

        {profileMsg && (
          <div
            className={`mb-4 text-sm p-3 rounded-lg flex items-center gap-2 ${
              profileMsg.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            <span>{profileMsg.type === "success" ? "✅" : "⚠️"}</span>
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Business Name</label>
            <input
              type="text"
              required
              value={pf.business_name}
              onChange={(e) => { setProfileForm({ ...pf, business_name: e.target.value }); setProfileMsg(null); }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Country</label>
            <select
              value={pf.country}
              onChange={(e) => { setProfileForm({ ...pf, country: e.target.value }); setProfileMsg(null); }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password / Google Info */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🔒</span>
          <div>
            <h3 className="font-semibold text-gray-900">Password & Security</h3>
            <p className="text-xs text-gray-500">
              {isGoogleUser ? "Your account is secured via Google" : "Change your login password"}
            </p>
          </div>
        </div>

        {isGoogleUser ? (
          <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Signed in with Google</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Your account is authenticated via Google OAuth. Password management is handled by Google.
                To change your password, visit your{" "}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Google Account Security settings
                </a>
                .
              </p>
            </div>
          </div>
        ) : (
          <>
            {pwMsg && (
              <div
                className={`mb-4 text-sm p-3 rounded-lg flex items-center gap-2 ${
                  pwMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                <span>{pwMsg.type === "success" ? "✅" : "⚠️"}</span>
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="text-sm font-medium text-gray-700">Current Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPw.current ? "text" : "password"}
                    name="current-password"
                    autoComplete="current-password"
                    required
                    value={pwForm.current_password}
                    onChange={(e) => { setPwForm({ ...pwForm, current_password: e.target.value }); setPwMsg(null); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPw.current ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPw.new ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    required
                    value={pwForm.new_password}
                    onChange={(e) => { setPwForm({ ...pwForm, new_password: e.target.value }); setPwMsg(null); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => ({ ...s, new: !s.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPw.new ? "Hide" : "Show"}
                  </button>
                </div>
                {/* Strength indicator */}
                {pwForm.new_password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => {
                        const strength = getPasswordStrength(pwForm.new_password);
                        return (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength
                                ? strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-yellow-400" : strength <= 3 ? "bg-blue-400" : "bg-green-500"
                                : "bg-gray-200"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {["", "Weak", "Fair", "Good", "Strong"][getPasswordStrength(pwForm.new_password)]} password
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm new password */}
              <div>
                <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPw.confirm ? "text" : "password"}
                    name="confirm-password"
                    autoComplete="new-password"
                    required
                    value={pwForm.confirm_password}
                    onChange={(e) => { setPwForm({ ...pwForm, confirm_password: e.target.value }); setPwMsg(null); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 ${
                      pwForm.confirm_password && pwForm.confirm_password !== pwForm.new_password
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPw.confirm ? "Hide" : "Show"}
                  </button>
                </div>
                {pwForm.confirm_password && pwForm.confirm_password !== pwForm.new_password && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={changingPw || pwForm.new_password !== pwForm.confirm_password}
                  className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {changingPw ? "Updating…" : "Change Password"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚠️</span>
          <h3 className="font-semibold text-gray-900">Account Information</h3>
        </div>
        <div className="text-sm text-gray-500 space-y-1">
          <p><span className="font-medium text-gray-700">Account ID:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{user.id}</code></p>
          <p><span className="font-medium text-gray-700">Tenant ID:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{tenant.id}</code></p>
          <p><span className="font-medium text-gray-700">Bot ID:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{tenant.bot_id}</code></p>
          <p><span className="font-medium text-gray-700">Account created:</span> {formatDate(user.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

/** Simple password strength scorer (0–4) */
function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}
