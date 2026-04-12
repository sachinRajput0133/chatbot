"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useDispatch } from "react-redux";
import { useLoginMutation, useGoogleAuthMutation, authApi } from "@/lib/api";
import { setAuth } from "@/lib/slices/authSlice";
import { store } from "@/lib/store";

/** Decode JWT payload to extract user fields — no external lib needed */
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

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const [login, { isLoading }] = useLoginMutation();
  const [googleAuth, { isLoading: googleLoading }] = useGoogleAuthMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await login(form).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(setAuth({ token: res.access_token, user: { ...parseToken(res.access_token), is_google_user: me.user.is_google_user } }));
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Invalid email or password.");
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    setError("");
    try {
      const res = await googleAuth({ credential: credentialResponse.credential }).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(setAuth({ token: res.access_token, user: { ...parseToken(res.access_token), is_google_user: me.user.is_google_user } }));
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Google sign-in failed. Try again.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Fixed Header */}
      <header className="fixed top-0 w-full flex justify-between items-center px-8 py-6 z-50 bg-transparent">
        <div className="text-2xl font-black text-gray-900 tracking-tighter">Lumina</div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-400 hover:text-gray-900 transition-colors cursor-pointer">Support</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-screen">
        {/* Left Panel: Hero Image + Headline */}
        <section className="relative w-full md:w-1/2 min-h-64 md:min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-black/30 z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80"
            alt="AI technology workspace"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-20 h-full flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-24 pb-16">
            <div className="max-w-xl">
              <h1 className="text-white text-5xl md:text-6xl leading-none font-extrabold tracking-tighter mb-6">
                Power your website{" "}
                <span style={{ color: "#ffb59e" }}>with Intelligent AI.</span>
              </h1>
              <p className="text-white/90 text-lg md:text-xl font-medium max-w-md">
                The ultimate engine for customer engagement, automated support, and seamless website integration.
              </p>
            </div>
          </div>
          {/* Decorative bar */}
          <div className="absolute bottom-16 left-0 w-32 h-2 z-20" style={{ backgroundColor: "#F15A24" }} />
        </section>

        {/* Right Panel: Login Form */}
        <section className="w-full md:w-1/2 flex items-center justify-center bg-white px-6 py-16 md:p-12 lg:p-24">
          <div className="w-full max-w-md space-y-10">
            <div className="space-y-3">
              <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">Welcome Back</h2>
              <p className="text-gray-500 font-medium">
                Enter your credentials to access your business intelligence dashboard.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2">
                <span>⚠</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Work Email */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900 tracking-wide" htmlFor="email">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full px-5 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  style={{ focusRingColor: "#F15A24" } as React.CSSProperties}
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #F15A24"; e.target.style.borderColor = "#F15A24"; }}
                  onBlur={(e) => { e.target.style.boxShadow = ""; e.target.style.borderColor = "#e5e7eb"; }}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-gray-900 tracking-wide" htmlFor="password">
                    Password
                  </label>
                  <a className="text-xs font-bold transition-colors hover:opacity-80" style={{ color: "#F15A24" }} href="#">
                    Forgot Password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-white border border-gray-200 rounded-xl transition-all outline-none text-gray-900"
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #F15A24"; e.target.style.borderColor = "#F15A24"; }}
                  onBlur={(e) => { e.target.style.boxShadow = ""; e.target.style.borderColor = "#e5e7eb"; }}
                />
              </div>

              {/* Sign In Button */}
              <div className="space-y-5 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || googleLoading}
                  className="w-full text-white py-5 px-8 rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "#F15A24" }}
                  onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.filter = "brightness(1.1)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.filter = ""; }}
                >
                  {isLoading ? "Signing in…" : "Sign In"}
                  {!isLoading && (
                    <span className="material-symbols-outlined text-2xl" style={{ fontFamily: "'Material Symbols Outlined'" }}>
                      arrow_forward
                    </span>
                  )}
                </button>

                {/* OR divider */}
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-gray-100" />
                  <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 tracking-widest">OR CONTINUE WITH</span>
                  <div className="flex-grow border-t border-gray-100" />
                </div>

                {/* Social Buttons */}
                <div className="flex gap-4">
                  {/* Google — uses native GoogleLogin, wrapped in flex-1 */}
                  <div className="flex-1 flex items-center justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google sign-in was cancelled or failed.")}
                      theme="outline"
                      size="large"
                      text="signin_with"
                      shape="rectangular"
                    />
                  </div>
                  {/* GitHub placeholder */}
                  <button
                    type="button"
                    disabled
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-50 rounded-xl font-bold text-gray-500 opacity-50 cursor-not-allowed border border-gray-200"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.341-3.369-1.341-.454-1.152-1.11-1.459-1.11-1.459-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    GitHub
                  </button>
                </div>
              </div>
            </form>

            <div className="text-center">
              <p className="text-gray-500 font-medium">
                Need an account?{" "}
                <Link href="/signup" className="font-bold hover:underline ml-1" style={{ color: "#F15A24" }}>
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 w-full flex justify-between items-center px-8 py-4 z-50 bg-transparent">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-900 text-lg">Lumina</span>
          <span className="text-sm text-gray-400 hidden sm:block">© 2024 Lumina. Intelligent Business Automation.</span>
        </div>
        <nav className="flex gap-6">
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Privacy</a>
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Terms</a>
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Security</a>
        </nav>
      </footer>
    </div>
  );
}
