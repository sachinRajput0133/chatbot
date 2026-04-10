"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useDispatch } from "react-redux";
import { useSignupMutation, useGoogleAuthMutation } from "@/lib/api";
import { setAuth } from "@/lib/slices/authSlice";

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" },
];

/** Decode JWT payload without a library */
function parseToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub as string,
      email: (payload.email as string) || "",
      role: (payload.role as string) || "owner",
      tenant_id: (payload.tenant_id as string) || "",
    };
  } catch {
    return { id: "", email: "", role: "owner", tenant_id: "" };
  }
}

export default function SignupPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ business_name: "", email: "", password: "", country: "US" });
  const [error, setError] = useState("");

  // Google signup — needs country + business_name before submitting
  const [googlePending, setGooglePending] = useState<{ credential: string } | null>(null);
  const [googleForm, setGoogleForm] = useState({ country: "US", business_name: "" });

  const [signup, { isLoading }] = useSignupMutation();
  const [googleAuth, { isLoading: googleLoading }] = useGoogleAuthMutation();

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await signup(form).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      router.push("/dashboard/onboarding");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Signup failed. Try again.");
    }
  }

  function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    // Decode name from Google JWT to prefill business_name
    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split(".")[1]));
      setGoogleForm((f) => ({ ...f, business_name: payload.name || "" }));
    } catch { /* ignore */ }
    setGooglePending({ credential: credentialResponse.credential });
  }

  async function completeGoogleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!googlePending) return;
    setError("");
    try {
      const res = await googleAuth({
        credential: googlePending.credential,
        country: googleForm.country,
        business_name: googleForm.business_name,
      }).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      router.push("/dashboard/onboarding");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Google sign-up failed.");
      setGooglePending(null);
    }
  }

  // ── Google completion step ──────────────────────────────────────────────────
  if (googlePending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-3">
              <span className="text-white text-xl">💬</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">One last step</h1>
            <p className="text-gray-500 text-sm mt-1">Tell us about your business</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={completeGoogleSignup} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Business Name</label>
              <input
                type="text"
                required
                value={googleForm.business_name}
                onChange={(e) => setGoogleForm({ ...googleForm, business_name: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="My Business"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Country</label>
              <select
                value={googleForm.country}
                onChange={(e) => setGoogleForm({ ...googleForm, country: e.target.value })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {googleForm.country === "IN" && (
                <p className="text-xs text-gray-500 mt-1">Billing via Razorpay (UPI, cards, net banking)</p>
              )}
            </div>
            <button
              type="submit"
              disabled={googleLoading}
              className="bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {googleLoading ? "Creating account…" : "Create Free Account"}
            </button>
            <button
              type="button"
              onClick={() => { setGooglePending(null); setError(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 text-center"
            >
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main signup form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-3">
            <span className="text-white text-xl">💬</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Free forever · No credit card required</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Google Button */}
        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google sign-up was cancelled or failed.")}
            theme="outline"
            size="large"
            width="100%"
            text="signup_with"
            shape="rectangular"
          />
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-white px-3">or sign up with email</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSignup} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Business Name</label>
            <input
              type="text"
              required
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="My Business"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Work Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Country</label>
            <select
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {form.country === "IN" && (
              <p className="text-xs text-gray-500 mt-1">Billing via Razorpay (UPI, cards, net banking)</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || googleLoading}
            className="bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {isLoading ? "Creating account…" : "Create Free Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
