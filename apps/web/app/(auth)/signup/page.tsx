"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, saveToken } from "@/lib/api";

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

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ business_name: "", email: "", password: "", country: "US" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { access_token } = await api.signup(form);
      saveToken(access_token);
      router.push("/dashboard/onboarding");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Create your account</h1>
        <p className="text-gray-500 text-center text-sm mb-6">Free forever · No credit card required</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            disabled={loading}
            className="bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Free Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
